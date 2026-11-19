import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_REASONING_OFF_ENCODING, DEFAULT_LLM_TOKEN_LIMIT_PARAM, isLlmReasoningOffEncoding, isLlmTokenLimitParam, LLM_REASONING_OFF_ENCODINGS, LLM_TOKEN_LIMIT_PARAMS, llmReasoningOffEncodingFor, normalizeLlmReasoningConfig, parseLlmReasoningOffEncoding } from './llm.model.wire';

describe('LLM_REASONING_OFF_ENCODINGS', () => {
  it('lists every encoding in message order', () => {
    expect([...LLM_REASONING_OFF_ENCODINGS]).toEqual(['effort-none', 'effort-minimal', 'nested-disabled', 'omit']);
  });

  it('defaults to effort-none', () => {
    expect(DEFAULT_LLM_REASONING_OFF_ENCODING).toBe('effort-none');
  });
});

describe('isLlmReasoningOffEncoding()', () => {
  it('accepts every member', () => {
    for (const encoding of LLM_REASONING_OFF_ENCODINGS) {
      expect(isLlmReasoningOffEncoding(encoding)).toBe(true);
    }
  });

  it('rejects a non-member string and a non-string', () => {
    expect(isLlmReasoningOffEncoding('minimal')).toBe(false);
    expect(isLlmReasoningOffEncoding(1)).toBe(false);
  });
});

describe('isLlmTokenLimitParam()', () => {
  it('accepts every member', () => {
    for (const param of LLM_TOKEN_LIMIT_PARAMS) {
      expect(isLlmTokenLimitParam(param)).toBe(true);
    }
  });

  it('rejects a non-member string and a non-string', () => {
    expect(isLlmTokenLimitParam('max_output_tokens')).toBe(false);
    expect(isLlmTokenLimitParam(1)).toBe(false);
  });

  it('includes the default param', () => {
    expect(LLM_TOKEN_LIMIT_PARAMS).toContain(DEFAULT_LLM_TOKEN_LIMIT_PARAM);
  });
});

describe('parseLlmReasoningOffEncoding()', () => {
  it('parses leniently: unset / blank / unrecognized ⇒ undefined, so a typo never reddens startup', () => {
    expect(parseLlmReasoningOffEncoding('EFFORT-MINIMAL')).toBe('effort-minimal');
    expect(parseLlmReasoningOffEncoding('  omit ')).toBe('omit');
    // The near-miss an operator writes: the WIRE value, not the encoding name.
    expect(parseLlmReasoningOffEncoding('minimal')).toBeUndefined();
    expect(parseLlmReasoningOffEncoding('')).toBeUndefined();
    expect(parseLlmReasoningOffEncoding(undefined)).toBeUndefined();
  });
});

describe('llmReasoningOffEncodingFor()', () => {
  it('orders the precedence by SPECIFICITY: per-model > fallback > the default', () => {
    expect(llmReasoningOffEncodingFor({ model: 'a/b', byModel: { 'a/b': 'effort-minimal' }, fallback: 'omit' })).toBe('effort-minimal');
    expect(llmReasoningOffEncodingFor({ model: 'c/d', byModel: { 'a/b': 'effort-minimal' }, fallback: 'omit' })).toBe('omit');
    expect(llmReasoningOffEncodingFor({ model: 'c/d' })).toBe(DEFAULT_LLM_REASONING_OFF_ENCODING);
    // A model-less call cannot consult the map, and must not inherit an unrelated slug's exception.
    expect(llmReasoningOffEncodingFor({ byModel: { 'a/b': 'effort-minimal' } })).toBe(DEFAULT_LLM_REASONING_OFF_ENCODING);
  });
});

describe('normalizeLlmReasoningConfig()', () => {
  it('keeps an absent config absent', () => {
    expect(normalizeLlmReasoningConfig(undefined)).toBeUndefined();
    expect(normalizeLlmReasoningConfig(null)).toBeUndefined();
  });

  it('reduces an OFF config to { enabled: false } alone', () => {
    expect(normalizeLlmReasoningConfig({ enabled: false, effort: 'high', maxTokens: 1, exclude: true })).toEqual({ enabled: false });
  });

  it('passes any other config through by reference', () => {
    const effortOnly = { effort: 'low' as const };
    const enabledWithEffort = { enabled: true, effort: 'high' as const };

    expect(normalizeLlmReasoningConfig(effortOnly)).toBe(effortOnly);
    expect(normalizeLlmReasoningConfig(enabledWithEffort)).toBe(enabledWithEffort);
  });
});
