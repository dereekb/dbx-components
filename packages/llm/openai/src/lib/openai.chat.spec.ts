import { describe, expect, it } from 'vitest';
import { LLM_REASONING_OFF_ENCODINGS } from '@dereekb/llm';
import { LLM_OPENAI_MAX_CALL_TIMEOUT_MS, LLM_OPENAI_REASONING_OFF_PARAMS, LLM_OPENAI_TOKENS_PER_SEC, llmOpenAiCallTimeoutMs, llmOpenAiReasoningParamsOf } from './openai.chat';

describe('LLM_OPENAI_REASONING_OFF_PARAMS', () => {
  it('maps every reasoning-OFF encoding, in the root order', () => {
    expect(Object.keys(LLM_OPENAI_REASONING_OFF_PARAMS)).toEqual([...LLM_REASONING_OFF_ENCODINGS]);
  });

  it('holds each wire shape', () => {
    expect(LLM_OPENAI_REASONING_OFF_PARAMS).toEqual({
      'effort-none': { reasoning_effort: 'none' },
      'effort-minimal': { reasoning_effort: 'minimal' },
      'nested-disabled': { reasoning: { enabled: false } },
      omit: {}
    });
  });
});

describe('llmOpenAiReasoningParamsOf()', () => {
  it('contributes nothing for an unset reasoning config', () => {
    expect(llmOpenAiReasoningParamsOf({ offEncoding: 'effort-none' })).toEqual({});
    expect(llmOpenAiReasoningParamsOf({ reasoning: null, offEncoding: 'effort-none' })).toEqual({});
  });

  it('maps an effort band onto reasoning_effort', () => {
    expect(llmOpenAiReasoningParamsOf({ reasoning: { effort: 'high' }, offEncoding: 'effort-none' })).toEqual({ reasoning_effort: 'high' });
  });

  it('encodes an explicit OFF even when an effort is co-present', () => {
    expect(llmOpenAiReasoningParamsOf({ reasoning: { enabled: false, effort: 'high' }, offEncoding: 'effort-minimal' })).toEqual({ reasoning_effort: 'minimal' });
    expect(llmOpenAiReasoningParamsOf({ reasoning: { enabled: false }, offEncoding: 'nested-disabled' })).toEqual({ reasoning: { enabled: false } });
  });

  it('contributes nothing for an empty reasoning config', () => {
    expect(llmOpenAiReasoningParamsOf({ reasoning: {}, offEncoding: 'effort-none' })).toEqual({});
  });
});

describe('llmOpenAiCallTimeoutMs()', () => {
  it('floors at the base, scales with the budget, and caps at 10 min', () => {
    expect(llmOpenAiCallTimeoutMs(60_000, 100)).toBe(60_000);
    expect(llmOpenAiCallTimeoutMs(60_000, 16_384)).toBe(Math.ceil((16_384 / LLM_OPENAI_TOKENS_PER_SEC) * 1000));
    expect(llmOpenAiCallTimeoutMs(60_000, 10_000_000)).toBe(LLM_OPENAI_MAX_CALL_TIMEOUT_MS);
  });
});
