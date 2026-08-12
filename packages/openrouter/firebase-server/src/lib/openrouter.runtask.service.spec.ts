import { describe, expect, it } from 'vitest';
import { type OpenRouterRunTask, OpenRouterRunTaskState, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from '@dereekb/openrouter/firebase';
import { OpenRouterPromptResolutionError } from './openrouter.prompt.service';
import { hasUnresolvedOpenRouterPendingToolCalls, isOpenRouterRunTaskClaimable, isRetryableOpenRouterError, openRouterDeferredToolResolutionsForRunTask, openRouterErrorCode, openRouterErrorMessage } from './openrouter.runtask.service';

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

describe('hasUnresolvedOpenRouterPendingToolCalls()', () => {
  const call = { callId: 'c1', name: 't', taskId: 'k1' };

  it('should report an unresolved call', () => {
    expect(hasUnresolvedOpenRouterPendingToolCalls([call], [])).toBe(true);
  });

  it('should report nothing unresolved once every call has a result', () => {
    expect(hasUnresolvedOpenRouterPendingToolCalls([call], [{ callId: 'c1', name: 't', output: 1 }])).toBe(false);
  });

  it('should ignore an orphan result that matches no pending call', () => {
    // The three hand-written copies of this predicate had drifted: one of them let a single orphan `utr`
    // entry mark EVERY pending call as settled.
    expect(hasUnresolvedOpenRouterPendingToolCalls([call], [{ callId: 'c9', name: 't', output: 1 }])).toBe(true);
  });

  it('should report nothing unresolved for no pending calls at all', () => {
    expect(hasUnresolvedOpenRouterPendingToolCalls(null, null)).toBe(false);
    expect(hasUnresolvedOpenRouterPendingToolCalls([], [])).toBe(false);
  });
});

describe('isRetryableOpenRouterError()', () => {
  it('should retry a transient status', () => {
    expect(isRetryableOpenRouterError({ status: 429 })).toBe(true);
    expect(isRetryableOpenRouterError({ status: 500 })).toBe(true);
    expect(isRetryableOpenRouterError({ status: 503 })).toBe(true);
    expect(isRetryableOpenRouterError({ statusCode: 408 })).toBe(true);
    expect(isRetryableOpenRouterError({ statusCode: 409 })).toBe(true);
  });

  it('should NOT retry a deterministic status', () => {
    // A bad key, an empty account, or a model id that does not exist answers identically on every attempt,
    // so spending the budget only delays the FAILED the owning work is waiting for.
    expect(isRetryableOpenRouterError({ status: 400 })).toBe(false);
    expect(isRetryableOpenRouterError({ status: 401 })).toBe(false);
    expect(isRetryableOpenRouterError({ status: 402 })).toBe(false);
    expect(isRetryableOpenRouterError({ status: 403 })).toBe(false);
    expect(isRetryableOpenRouterError({ status: 404 })).toBe(false);
  });

  it('should read the numeric code OpenRouter reports in a response body', () => {
    // This is the path that reaches recordFailure WITHOUT throwing, so it has to classify too.
    expect(isRetryableOpenRouterError({ code: 402, message: 'out of credits' })).toBe(false);
    expect(isRetryableOpenRouterError({ code: '402', message: 'out of credits' })).toBe(false);
    expect(isRetryableOpenRouterError({ code: 503, message: 'unavailable' })).toBe(true);
  });

  it('should retry a socket-level failure', () => {
    expect(isRetryableOpenRouterError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableOpenRouterError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryableOpenRouterError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isRetryableOpenRouterError({ code: 'EAI_AGAIN' })).toBe(true);
  });

  it('should retry a Firestore/GCS infrastructure transient', () => {
    expect(isRetryableOpenRouterError({ code: 'UNAVAILABLE' })).toBe(true);
    expect(isRetryableOpenRouterError({ code: 'DEADLINE_EXCEEDED' })).toBe(true);
    expect(isRetryableOpenRouterError({ code: 'ABORTED' })).toBe(true);
  });

  it('should NOT retry a prompt resolution failure', () => {
    // Deterministic by construction: the prompt either exists at that version or it never will.
    expect(isRetryableOpenRouterError(new OpenRouterPromptResolutionError('p', 'does not exist.', 3))).toBe(false);
  });

  it('should default an unrecognized failure to RETRYABLE', () => {
    // The table is a whitelist of the known-PERMANENT, not of the retryable: an unknown failure is far more
    // likely a transient blip, and the attempt budget bounds the cost of being wrong either way.
    expect(isRetryableOpenRouterError({ code: 'server_error', message: 'nope' })).toBe(true);
    expect(isRetryableOpenRouterError(new Error('boom'))).toBe(true);
    expect(isRetryableOpenRouterError('boom')).toBe(true);
    expect(isRetryableOpenRouterError(null)).toBe(true);
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
  it('should order the runnable query by queue time alone', () => {
    // Queue order is the ONLY order. A priority column costs a second composite index and buys a second
    // failure mode: Firestore sorts `null` before every number, so one task written without a priority
    // would jump the entire queue.
    expect(openRouterRunTasksRunnableQuery({ limit: 10 }).length).toBe(3);
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
