/**
 * The dispatch tap registry — proves the two contracts the seam is built on: (1) the IDEMPOTENT cleanup, strict
 * enough that a stale double-detach cannot remove a re-registration of the same tap object; and (2) the never-throw +
 * COUNT discipline, so a broken probe is visible in `health()` rather than able to abort the fan-out or reach the
 * dispatcher. Plus the reference collector, and the host's top-level fields riding every event.
 */

import { describe, it, expect } from 'vitest';
import type { LlmDispatchResult } from '../strategy/llm.strategy';
import type { LlmDispatchCompleteTapEvent, LlmDispatchStartTapEvent, LlmDecodeFailureTapEvent } from './llm.dispatch.tap';
import { DEFAULT_LLM_DISPATCH_COLLECTOR_ID, makeLlmDispatchCollector, makeLlmDispatchTapRegistry } from './llm.dispatch.tap';

const RESULT: LlmDispatchResult = { text: 'ok', strategyId: 'fake', capability: 'summarize' };

const START: LlmDispatchStartTapEvent = { capability: 'summarize', model: 'a/b', prompt: 'A-PROMPT', estimatedPromptTokens: 2 };
const COMPLETE: LlmDispatchCompleteTapEvent = { capability: 'summarize', prompt: 'A-PROMPT', segments: [{ id: 'follow-up', promptSegment: 'A-PROMPT', origin: { kind: 'follow-up' } }], result: RESULT };
const DECODE: LlmDecodeFailureTapEvent = { capability: 'summarize', attempt: { attempt: 1, class: 'parse-error', excerpt: 'nope', rawLength: 4 }, willRetry: true };

describe('makeLlmDispatchTapRegistry', () => {
  it('a fresh registry is empty and clean', () => {
    const registry = makeLlmDispatchTapRegistry();

    expect(registry.size).toBe(0);
    expect(registry.health()).toEqual({ taps: 0, failures: 0, byTap: {} });
    expect(registry.health().lastError).toBeUndefined();
  });

  it('addTap returns a cleanup that detaches; a SECOND call is a no-op and cannot remove a re-registration', () => {
    const registry = makeLlmDispatchTapRegistry();
    const collector = makeLlmDispatchCollector();
    const detach = registry.addTap(collector.tap);

    registry.emitDispatch(START);
    expect(collector.dispatches().length).toBe(1);

    detach();
    expect(registry.size).toBe(0);
    registry.emitDispatch(START);
    expect(collector.dispatches().length).toBe(1); // detached ⇒ no further events.

    // Re-register the SAME tap object, then fire the STALE cleanup: strict idempotence means it must not
    // silently remove the live re-registration.
    registry.addTap(collector.tap);
    detach();
    expect(registry.size).toBe(1);
    registry.emitDispatch(START);
    expect(collector.dispatches().length).toBe(2);
  });

  it('size tracks add/detach and counts a tap added twice ONCE (Set identity)', () => {
    const registry = makeLlmDispatchTapRegistry();
    const collector = makeLlmDispatchCollector();

    registry.addTap(collector.tap);
    const second = registry.addTap(collector.tap);
    expect(registry.size).toBe(1);

    // One membership ⇒ one delivery, even though it was added twice.
    registry.emitDispatchComplete(COMPLETE);
    expect(collector.completions().length).toBe(1);

    second();
    expect(registry.size).toBe(0);
  });

  it('a tap declaring only onDispatchComplete receives completions and is skipped for the other two seams', () => {
    const registry = makeLlmDispatchTapRegistry();
    const seen: LlmDispatchCompleteTapEvent[] = [];
    registry.addTap({ id: 'debug-feed', onDispatchComplete: (event) => void seen.push(event) });

    registry.emitDispatch(START);
    registry.emitDecodeFailure(DECODE);
    registry.emitDispatchComplete(COMPLETE);

    expect(seen).toEqual([COMPLETE]);
    expect(registry.health().failures).toBe(0);
  });

  it('a THROWING tap is swallowed + counted, and does NOT abort the fan-out to the other taps', () => {
    const registry = makeLlmDispatchTapRegistry();
    const collector = makeLlmDispatchCollector();
    registry.addTap({
      id: 'debug-feed',
      onDispatch: () => {
        throw new Error('probe exploded');
      }
    });
    registry.addTap(collector.tap);

    expect(() => registry.emitDispatch(START)).not.toThrow();

    const health = registry.health();
    expect(health.taps).toBe(2);
    expect(health.failures).toBe(1);
    expect(health.lastError).toBe('probe exploded');
    expect(health.byTap['debug-feed']).toBe(1);
    // The second tap still received the SAME event — one broken probe does not blind the others.
    expect(collector.dispatches()).toEqual([START]);
  });

  it('a tap returning a REJECTED promise is swallowed + counted (no unhandled rejection)', async () => {
    const registry = makeLlmDispatchTapRegistry();
    registry.addTap({ id: 'probe', onDispatchComplete: () => Promise.reject(new Error('async probe failed')) });

    registry.emitDispatchComplete(COMPLETE);
    await Promise.resolve(); // let the attached `.catch` run.

    expect(registry.health()).toEqual({ taps: 1, failures: 1, lastError: 'async probe failed', byTap: { probe: 1 } });
  });

  it('tallies per tap id across all three seams and keeps the last error', () => {
    const registry = makeLlmDispatchTapRegistry();
    const boom = (): never => {
      throw new Error('boom');
    };
    registry.addTap({ id: 'debug-feed', onDispatch: boom, onDispatchComplete: boom, onDecodeFailure: () => boom() });

    registry.emitDispatch(START);
    registry.emitDispatchComplete(COMPLETE);
    registry.emitDecodeFailure(DECODE);

    expect(registry.health().failures).toBe(3);
    expect(registry.health().byTap['debug-feed']).toBe(3);
    expect(registry.health().lastError).toBe('boom');
  });

  it('a NON-Error throw is stringified into lastError rather than swallowed silently', () => {
    const registry = makeLlmDispatchTapRegistry();
    registry.addTap({
      id: 'debug-feed',
      onDecodeFailure: () => {
        throw 'plain string failure';
      }
    });

    registry.emitDecodeFailure(DECODE);

    expect(registry.health().lastError).toBe('plain string failure');
  });

  it('a tap that detaches itself mid-fan-out is simply skipped (the Set is iterated LIVE)', () => {
    const registry = makeLlmDispatchTapRegistry();
    const collector = makeLlmDispatchCollector();
    const detachSecond = registry.addTap(collector.tap);
    registry.addTap({ id: 'debug-feed', onDispatch: () => detachSecond() });

    // Insertion order: the collector runs first (still attached), then the detacher removes it.
    registry.emitDispatch(START);
    expect(collector.dispatches().length).toBe(1);
    expect(registry.size).toBe(1);

    registry.emitDispatch(START);
    expect(collector.dispatches().length).toBe(1); // gone from the fan-out.
    expect(registry.health().failures).toBe(0);
  });
});

describe('makeLlmDispatchTapRegistry with host fields', () => {
  it("hands the tap the host's top-level fields beside the library's", () => {
    interface RequestFields {
      readonly requestId: string;
    }

    const registry = makeLlmDispatchTapRegistry<RequestFields>();
    const seen: string[] = [];
    registry.addTap({
      id: 'debug-feed',
      onDispatch: (event) => void seen.push(`${event.requestId}:${event.capability}`),
      onDispatchComplete: (event) => void seen.push(`${event.requestId}:${event.result.text}`),
      onDecodeFailure: (event) => void seen.push(`${event.requestId}:${event.attempt.class}`)
    });

    registry.emitDispatch({ ...START, requestId: 'r1' });
    registry.emitDispatchComplete({ ...COMPLETE, requestId: 'r2' });
    registry.emitDecodeFailure({ ...DECODE, requestId: 'r3' });

    expect(seen).toEqual(['r1:summarize', 'r2:ok', 'r3:parse-error']);
  });
});

describe('makeLlmDispatchCollector', () => {
  it('registers under DEFAULT_LLM_DISPATCH_COLLECTOR_ID unless overridden', () => {
    expect(makeLlmDispatchCollector().tap.id).toBe(DEFAULT_LLM_DISPATCH_COLLECTOR_ID);
    expect(makeLlmDispatchCollector({ id: 'probe' }).tap.id).toBe('probe');
  });

  it('accumulates each seam separately and reset() drops everything', () => {
    const registry = makeLlmDispatchTapRegistry();
    const collector = makeLlmDispatchCollector({ id: 'debug-feed' });
    registry.addTap(collector.tap);

    registry.emitDispatch(START);
    registry.emitDispatchComplete(COMPLETE);
    registry.emitDecodeFailure(DECODE);
    registry.emitDecodeFailure(DECODE);

    expect(collector.tap.id).toBe('debug-feed');
    expect(collector.dispatches()).toEqual([START]);
    expect(collector.completions()).toEqual([COMPLETE]);
    expect(collector.decodeFailures().length).toBe(2);

    collector.reset();
    expect(collector.dispatches()).toEqual([]);
    expect(collector.completions()).toEqual([]);
    expect(collector.decodeFailures()).toEqual([]);
  });
});
