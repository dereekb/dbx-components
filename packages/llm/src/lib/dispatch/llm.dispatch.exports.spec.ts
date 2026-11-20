import { describe, expect, it } from 'vitest';

/**
 * Pins the dispatch barrel's runtime exports. Stage modules are internal (specs import them by path), so a new public
 * dispatch export is a deliberate edit to `index.ts` and to this list.
 */
const LLM_DISPATCH_RUNTIME_EXPORTS: readonly string[] = [
  'DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS',
  'DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS',
  'LLM_DECIDE_STAMP_SWALLOW_SITE',
  'LLM_RETRY_BONUS_LEVER',
  'LLM_RETRY_BUDGET_RAISE_FACTOR',
  'LLM_RETRY_INDUCED_BONUS_ATTEMPTS',
  'LLM_RETRY_OUTPUT_BUDGET_CEILING',
  'LLM_RETRY_REASONING_LOW',
  'LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR',
  'LLM_TRANSPORT_RETRY_AFTER_MAX_MS',
  'LLM_TRANSPORT_RETRY_BASE_DELAY_MS',
  'LLM_TRANSPORT_RETRY_MAX_DELAY_MS',
  'LlmDispatchFaultError',
  'applyLlmRetryLever',
  'chooseLlmRetryLever',
  'isLlmDispatchFaultError',
  'llmTransportBackoffMs',
  'makeLlmDispatcher',
  'makeLlmDispatcherFromDispatch'
];

describe('dispatch exports', () => {
  it('exports exactly the documented runtime surface', async () => {
    const exported = Object.keys(await import('./index')).sort();
    expect(exported).toEqual(LLM_DISPATCH_RUNTIME_EXPORTS);
  });

  it('does not export the stage functions', async () => {
    const barrel: Record<string, unknown> = await import('./index');
    const stageFunctions = ['sendLlmDispatchAttempt', 'readLlmDispatchReply', 'runLlmReplyRepairLane', 'composeLlmDispatch', 'resolveLlmDispatch', 'runLlmDispatchAttempts', 'runSingleShotLlmDispatch', 'makeLlmDispatchRetryLadder', 'makeLlmDispatchDecisionLane', 'recordLlmDispatch'];
    expect(stageFunctions.filter((name) => name in barrel)).toEqual([]);
  });
});
