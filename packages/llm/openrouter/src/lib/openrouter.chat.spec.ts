import { describe, expect, it } from 'vitest';
import { toLlmOpenRouterReasoning } from './openrouter.chat';

describe('toLlmOpenRouterReasoning()', () => {
  it('maps an empty config onto an empty param', () => {
    expect(toLlmOpenRouterReasoning({})).toEqual({});
  });

  it('spreads each configured field, renaming maxTokens to max_tokens', () => {
    expect(toLlmOpenRouterReasoning({ effort: 'high' })).toEqual({ effort: 'high' });
    expect(toLlmOpenRouterReasoning({ maxTokens: 512 })).toEqual({ max_tokens: 512 });
    expect(toLlmOpenRouterReasoning({ exclude: true })).toEqual({ exclude: true });
    expect(toLlmOpenRouterReasoning({ enabled: false })).toEqual({ enabled: false });
    expect(toLlmOpenRouterReasoning({ effort: 'low', maxTokens: 256, exclude: false, enabled: true })).toEqual({ effort: 'low', max_tokens: 256, exclude: false, enabled: true });
  });
});
