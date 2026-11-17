import { describe, expect, it } from 'vitest';
import { LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS, LLM_OPENROUTER_TOKENS_PER_SEC, llmOpenRouterCallTimeoutMs, llmOpenRouterReasoningOf } from './openrouter.chat';

describe('llmOpenRouterReasoningOf()', () => {
  it('maps an empty config onto an empty param', () => {
    expect(llmOpenRouterReasoningOf({})).toEqual({});
  });

  it('spreads each configured field, renaming maxTokens to max_tokens', () => {
    expect(llmOpenRouterReasoningOf({ effort: 'high' })).toEqual({ effort: 'high' });
    expect(llmOpenRouterReasoningOf({ maxTokens: 512 })).toEqual({ max_tokens: 512 });
    expect(llmOpenRouterReasoningOf({ exclude: true })).toEqual({ exclude: true });
    expect(llmOpenRouterReasoningOf({ enabled: false })).toEqual({ enabled: false });
    expect(llmOpenRouterReasoningOf({ effort: 'low', maxTokens: 256, exclude: false, enabled: true })).toEqual({ effort: 'low', max_tokens: 256, exclude: false, enabled: true });
  });
});

describe('llmOpenRouterCallTimeoutMs()', () => {
  it('floors at the base, scales with the budget, and caps at 10 min', () => {
    // At/below the floor → the base timeout.
    expect(llmOpenRouterCallTimeoutMs(60_000, 100)).toBe(60_000);
    // Above the floor → maxOutputTokens / LLM_OPENROUTER_TOKENS_PER_SEC × 1000.
    expect(llmOpenRouterCallTimeoutMs(60_000, 16_384)).toBe(Math.ceil((16_384 / LLM_OPENROUTER_TOKENS_PER_SEC) * 1000));
    // A pathological budget is capped.
    expect(llmOpenRouterCallTimeoutMs(60_000, 10_000_000)).toBe(LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS);
  });
});
