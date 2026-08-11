import { describe, expect, it } from 'vitest';
import { type OpenRouterRunTask, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { handleOpenRouterRunTaskResult, handleOpenRouterRunTaskResultFactory, openRouterRunTaskOutcome } from './openrouter.runtask.handle';
import { mergedOpenRouterRunUsage, openRouterRunTaskKeyFromBroadcastAttributes } from './openrouter.broadcast';

function task(state: OpenRouterRunTaskState): OpenRouterRunTask {
  return { s: state, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [] };
}

describe('openRouterRunTaskOutcome()', () => {
  it('should map states onto the three branches an async checkpoint needs', () => {
    expect(openRouterRunTaskOutcome(task(OpenRouterRunTaskState.COMPLETE))).toBe('complete');
    expect(openRouterRunTaskOutcome(task(OpenRouterRunTaskState.FAILED))).toBe('failure');
    expect(openRouterRunTaskOutcome(task(OpenRouterRunTaskState.QUEUED))).toBe('queued');
    expect(openRouterRunTaskOutcome(task(OpenRouterRunTaskState.RUNNING))).toBe('queued');
  });

  it('should report a deferred-tool pause as queued, because it IS waiting', () => {
    expect(openRouterRunTaskOutcome(task(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS))).toBe('queued');
  });

  it('should distinguish a missing document from a failed one', () => {
    // A missing document usually means the enqueue never landed — genuinely different from a failure.
    expect(openRouterRunTaskOutcome(null)).toBe('missing');
  });
});

describe('handleOpenRouterRunTaskResult()', () => {
  const handlers = {
    onComplete: () => 'complete' as const,
    onQueued: () => 'queued' as const,
    onFailure: () => 'failure' as const,
    onMissing: () => 'missing' as const
  };

  it('should dispatch to the matching handler', async () => {
    expect(await handleOpenRouterRunTaskResult(task(OpenRouterRunTaskState.COMPLETE), handlers)).toBe('complete');
    expect(await handleOpenRouterRunTaskResult(task(OpenRouterRunTaskState.RUNNING), handlers)).toBe('queued');
    expect(await handleOpenRouterRunTaskResult(task(OpenRouterRunTaskState.FAILED), handlers)).toBe('failure');
    expect(await handleOpenRouterRunTaskResult(null, handlers)).toBe('missing');
  });

  it('should await an async handler', async () => {
    expect(await handleOpenRouterRunTaskResult(task(OpenRouterRunTaskState.COMPLETE), { ...handlers, onComplete: async () => 'async' as const })).toBe('async');
  });

  it('should produce a reusable dispatcher', async () => {
    const dispatch = handleOpenRouterRunTaskResultFactory(handlers);
    expect(await dispatch(task(OpenRouterRunTaskState.COMPLETE))).toBe('complete');
    expect(await dispatch(null)).toBe('missing');
  });
});

describe('openRouterRunTaskKeyFromBroadcastAttributes()', () => {
  it('should read the run key from the bare attribute name', () => {
    expect(openRouterRunTaskKeyFromBroadcastAttributes(new Map([['runTaskKey', 'rt_1']]))).toBe('rt_1');
  });

  it('should read the run key from a prefixed attribute name', () => {
    // The exact prefix is not contractual, so several candidates are checked.
    expect(openRouterRunTaskKeyFromBroadcastAttributes(new Map([['trace.runTaskKey', 'rt_2']]))).toBe('rt_2');
  });

  it('should return undefined for a span carrying no run key', () => {
    expect(openRouterRunTaskKeyFromBroadcastAttributes(new Map([['gen_ai.response.id', 'gen_1']]))).toBeUndefined();
    expect(openRouterRunTaskKeyFromBroadcastAttributes(null)).toBeUndefined();
  });
});

describe('mergedOpenRouterRunUsage()', () => {
  it('should let the broadcast value win, since it is the later measurement', () => {
    const merged = mergedOpenRouterRunUsage({ cost: 0.01, totalTokens: 10 }, { cost: 0.02, totalTokens: 12 });
    expect(merged.cost).toBe(0.02);
    expect(merged.totalTokens).toBe(12);
  });

  it('should keep stored values the span is silent about', () => {
    // An incomplete span must not erase what the runner already knew.
    const merged = mergedOpenRouterRunUsage({ cost: 0.01, totalTokens: 10, reasoningTokens: 3, isByok: true }, {});
    expect(merged.cost).toBe(0.01);
    expect(merged.totalTokens).toBe(10);
    expect(merged.reasoningTokens).toBe(3);
    expect(merged.isByok).toBe(true);
  });

  it('should work with no stored usage at all', () => {
    expect(mergedOpenRouterRunUsage(null, { promptTokens: 5, completionTokens: 2, totalTokens: 7 })).toMatchObject({ inputTokens: 5, outputTokens: 2, totalTokens: 7 });
  });
});
