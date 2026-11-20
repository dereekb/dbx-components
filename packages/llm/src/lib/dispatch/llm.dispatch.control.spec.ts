import { describe, expect, it } from 'vitest';
import { makeLlmCallContext } from '../record/llm.call.context';
import { LLM_TRANSPORT_RETRY_MAX_DELAY_MS, type LlmDispatchPauseSignal, llmDispatchSignalOf, llmTransportBackoffMs, parkLlmDispatchWhilePaused } from './llm.dispatch.control';

function gate(paused: boolean): LlmDispatchPauseSignal & { readonly resume: () => void } {
  let resolveWait: () => void = () => undefined;
  let isPaused = paused;
  return {
    isPaused: () => isPaused,
    waitUntilResumed: () =>
      new Promise<void>((resolve) => {
        resolveWait = resolve;
      }),
    resume: () => {
      isPaused = false;
      resolveWait();
    }
  };
}

describe('parkLlmDispatchWhilePaused()', () => {
  it('should not park, and record no span, when not paused', async () => {
    const callContext = makeLlmCallContext({ label: 'call', timing: true });

    expect(await parkLlmDispatchWhilePaused({ pause: gate(false), callContext })).toBe(false);
    expect(await parkLlmDispatchWhilePaused({ callContext })).toBe(false);
    expect(callContext.profile().spans).toHaveLength(0);
  });

  it('should park until resumed and record a paused span', async () => {
    const callContext = makeLlmCallContext({ label: 'call', timing: true });
    const pause = gate(true);
    const parked = parkLlmDispatchWhilePaused({ pause, callContext });
    pause.resume();

    expect(await parked).toBe(true);
    expect(callContext.profile().spans.map((span) => span.name)).toEqual(['paused']);
  });

  it('should end the park on abort even when the gate ignores the signal', async () => {
    const callContext = makeLlmCallContext({ label: 'call' });
    const controller = new AbortController();
    const parked = parkLlmDispatchWhilePaused({ pause: gate(true), signal: controller.signal, callContext });
    controller.abort();

    expect(await parked).toBe(true);
  });

  it('should read a gate rejection on an aborted signal as an ended park, and propagate any other rejection', async () => {
    const callContext = makeLlmCallContext({ label: 'call' });
    const controller = new AbortController();
    const rejecting: LlmDispatchPauseSignal = { isPaused: () => true, waitUntilResumed: () => (controller.abort(), Promise.reject(new Error('aborted'))) };

    expect(await parkLlmDispatchWhilePaused({ pause: rejecting, signal: controller.signal, callContext })).toBe(true);
    await expect(parkLlmDispatchWhilePaused({ pause: { isPaused: () => true, waitUntilResumed: () => Promise.reject(new Error('broken')) }, signal: new AbortController().signal, callContext })).rejects.toThrow('broken');
  });
});

describe('llmDispatchSignalOf()', () => {
  it('should return whichever signal exists, or none', () => {
    const signal = new AbortController().signal;

    expect(llmDispatchSignalOf({ request: {} })).toBeUndefined();
    expect(llmDispatchSignalOf({ cancellationSignal: signal, request: {} })).toBe(signal);
    expect(llmDispatchSignalOf({ request: { signal } })).toBe(signal);
  });

  it('should combine both signals so either aborts the forwarded one', () => {
    for (const which of ['dispatcher', 'request'] as const) {
      const dispatcher = new AbortController();
      const requestController = new AbortController();
      const combined = llmDispatchSignalOf({ cancellationSignal: dispatcher.signal, request: { signal: requestController.signal } });

      expect(combined?.aborted).toBe(false);
      (which === 'dispatcher' ? dispatcher : requestController).abort();
      expect(combined?.aborted).toBe(true);
    }
  });
});

describe('llmTransportBackoffMs()', () => {
  it('should half-jitter an exponential step capped at the max', () => {
    expect(llmTransportBackoffMs(1, () => 0)).toBe(250);
    expect(llmTransportBackoffMs(1, () => 1)).toBe(500);
    expect(llmTransportBackoffMs(2, () => 1)).toBe(1000);
    expect(llmTransportBackoffMs(20, () => 1)).toBe(LLM_TRANSPORT_RETRY_MAX_DELAY_MS);
    expect(llmTransportBackoffMs(20, () => 0)).toBe(4000);
  });
});
