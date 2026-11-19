import { describe, expect, it } from 'vitest';
import { llmOpenRouterReasoningOf } from './openrouter.chat';

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
