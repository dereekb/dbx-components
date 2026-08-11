import { describe, expect, it } from 'vitest';
import { type OpenRouterRunTask, OpenRouterRunTaskState, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from '@dereekb/openrouter/firebase';
import { isOpenRouterRunTaskClaimable, mergedGenerationIds, openRouterDeferredToolResolutionsForRunTask, openRouterErrorCode, openRouterErrorMessage } from './openrouter.runtask.service';

function task(overrides: Partial<OpenRouterRunTask>): OpenRouterRunTask {
  return { s: OpenRouterRunTaskState.QUEUED, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], ...overrides };
}

describe('isOpenRouterRunTaskClaimable()', () => {
  const cutoff = new Date('2026-01-01T00:00:00Z');

  it('should claim a QUEUED task', () => {
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.QUEUED }), cutoff)).toBe(true);
  });

  it('should NOT claim a RUNNING task whose lease is still fresh', () => {
    // The double-run guard: a healthy run is never stolen from itself.
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.RUNNING, lat: new Date('2026-01-01T00:05:00Z') }), cutoff)).toBe(false);
  });

  it('should reclaim a RUNNING task whose lease has gone stale', () => {
    // Crash recovery, generalising "unstick anything processing for over an hour".
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.RUNNING, lat: new Date('2025-12-31T23:00:00Z') }), cutoff)).toBe(true);
  });

  it('should reclaim a RUNNING task with no lease recorded at all', () => {
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.RUNNING, lat: undefined }), cutoff)).toBe(true);
  });

  it('should NOT claim a terminal task', () => {
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.COMPLETE }), cutoff)).toBe(false);
    expect(isOpenRouterRunTaskClaimable(task({ s: OpenRouterRunTaskState.FAILED }), cutoff)).toBe(false);
  });

  it('should NOT claim an AWAITING_ASYNC_TOOLS task with an unresolved call', () => {
    const awaiting = task({
      s: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS,
      ptc: [
        { callId: 'c1', name: 't', taskId: 'k1' },
        { callId: 'c2', name: 't', taskId: 'k2' }
      ],
      utr: [{ callId: 'c1', name: 't', output: 1 }]
    });

    expect(isOpenRouterRunTaskClaimable(awaiting, cutoff)).toBe(false);
  });

  it('should claim an AWAITING_ASYNC_TOOLS task once every call is resolved', () => {
    const awaiting = task({
      s: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS,
      ptc: [{ callId: 'c1', name: 't', taskId: 'k1' }],
      utr: [{ callId: 'c1', name: 't', output: 1 }]
    });

    expect(isOpenRouterRunTaskClaimable(awaiting, cutoff)).toBe(true);
  });
});

describe('mergedGenerationIds()', () => {
  it('should append rather than replace, so a retried run keeps its earlier generations', () => {
    expect(mergedGenerationIds(['g1'], ['g2'])).toEqual(['g1', 'g2']);
  });

  it('should de-duplicate', () => {
    expect(mergedGenerationIds(['g1'], ['g1'])).toEqual(['g1']);
  });

  it('should handle empty inputs', () => {
    expect(mergedGenerationIds(null, null)).toEqual([]);
  });
});

describe('openRouterDeferredToolResolutionsForRunTask()', () => {
  it('should pair recorded results back to their task ids', () => {
    const resolutions = openRouterDeferredToolResolutionsForRunTask(
      task({
        ptc: [{ callId: 'c1', name: 't', taskId: 'ticket_1' }],
        utr: [{ callId: 'c1', name: 't', output: { ok: true } }]
      })
    );

    expect(resolutions).toEqual([{ taskId: 'ticket_1', output: { ok: true } }]);
  });

  it('should carry an error resolution through', () => {
    const resolutions = openRouterDeferredToolResolutionsForRunTask(
      task({
        ptc: [{ callId: 'c1', name: 't', taskId: 'ticket_1' }],
        utr: [{ callId: 'c1', name: 't', error: 'declined' }]
      })
    );

    expect(resolutions).toEqual([{ taskId: 'ticket_1', error: 'declined' }]);
  });

  it('should drop a result with no matching pending call', () => {
    expect(openRouterDeferredToolResolutionsForRunTask(task({ ptc: [], utr: [{ callId: 'c9', name: 't', output: 1 }] }))).toEqual([]);
  });
});

describe('query constraints', () => {
  it('should build the runnable query without a priority order by default', () => {
    // Firestore excludes a document from an orderBy on a field it lacks, so ordering by the optional `pr`
    // would silently drop every task that never set a priority.
    const withoutPriority = openRouterRunTasksRunnableQuery({ limit: 10, usePriorityOrder: false });
    const withPriority = openRouterRunTasksRunnableQuery({ limit: 10, usePriorityOrder: true });

    expect(withPriority.length).toBe(withoutPriority.length + 1);
  });

  it('should build a reclaimable query filtering on the lease cutoff', () => {
    const constraints = openRouterRunTasksReclaimableQuery({ limit: 5, leaseCutoff: new Date() });
    expect(constraints.length).toBe(4);
  });
});

describe('error extraction', () => {
  it('should read a code off an error-like object', () => {
    expect(openRouterErrorCode({ code: 'ETIMEDOUT' })).toBe('ETIMEDOUT');
  });

  it('should fall back to the error name', () => {
    expect(openRouterErrorCode(new TypeError('bad'))).toBe('TypeError');
  });

  it('should return undefined for a primitive', () => {
    expect(openRouterErrorCode('boom')).toBeUndefined();
  });

  it('should read a message off an Error and stringify anything else', () => {
    expect(openRouterErrorMessage(new Error('boom'))).toBe('boom');
    expect(openRouterErrorMessage('boom')).toBe('boom');
  });
});
