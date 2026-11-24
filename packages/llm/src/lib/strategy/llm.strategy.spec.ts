import { describe, expect, it } from 'vitest';
import { LLM_COMPLETION_MAX_CALL_TIMEOUT_MS, LLM_COMPLETION_TOKENS_PER_SEC, resolveLlmCompletionCallTimeoutMs } from './llm.strategy';

describe('resolveLlmCompletionCallTimeoutMs()', () => {
  it('floors at the base, scales with the budget, and caps at 10 min', () => {
    expect(resolveLlmCompletionCallTimeoutMs({ timeoutMs: 60_000, maxOutputTokens: 100 })).toBe(60_000);
    expect(resolveLlmCompletionCallTimeoutMs({ timeoutMs: 60_000, maxOutputTokens: 16_384 })).toBe(Math.ceil((16_384 / LLM_COMPLETION_TOKENS_PER_SEC) * 1000));
    expect(resolveLlmCompletionCallTimeoutMs({ timeoutMs: 60_000, maxOutputTokens: 10_000_000 })).toBe(LLM_COMPLETION_MAX_CALL_TIMEOUT_MS);
  });

  it('matches the documented example', () => {
    expect(resolveLlmCompletionCallTimeoutMs({ timeoutMs: 60_000, maxOutputTokens: 8_192 })).toBe(273_067);
  });
});
