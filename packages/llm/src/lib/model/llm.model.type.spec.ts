import { ArkErrors } from 'arktype';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { llmModelSlugType, llmModelTierValueType, llmNonBlankStringType, llmReasoningConfigType, llmReasoningEffortType, llmTokenCountType } from './llm.model.type';
import { LLM_REASONING_EFFORTS, type LlmReasoningEffort } from './llm.model.wire';
import { type LlmModelTierConfig, type LlmReasoningConfig } from './llm.value';

function isValid(result: unknown): boolean {
  return !(result instanceof ArkErrors);
}

describe('llmModelSlugType', () => {
  it('accepts a trimmed, non-empty slug', () => {
    expect(isValid(llmModelSlugType('vendor/model'))).toBe(true);
  });

  it('rejects an untrimmed or empty slug', () => {
    expect(isValid(llmModelSlugType(' vendor/model'))).toBe(false);
    expect(isValid(llmModelSlugType('vendor/model '))).toBe(false);
    expect(isValid(llmModelSlugType(''))).toBe(false);
  });
});

describe('llmNonBlankStringType', () => {
  it('rejects a blank string but does not require trimming', () => {
    expect(isValid(llmNonBlankStringType('   '))).toBe(false);
    expect(isValid(llmNonBlankStringType(' strong '))).toBe(true);
  });
});

describe('llmTokenCountType', () => {
  it('accepts only positive integers', () => {
    expect(isValid(llmTokenCountType(1))).toBe(true);
    expect(isValid(llmTokenCountType(1.5))).toBe(false);
    expect(isValid(llmTokenCountType(0))).toBe(false);
    expect(isValid(llmTokenCountType('10'))).toBe(false);
  });
});

describe('llmReasoningEffortType', () => {
  it('accepts exactly LLM_REASONING_EFFORTS', () => {
    expect(LLM_REASONING_EFFORTS).toEqual(['low', 'medium', 'high']);
    LLM_REASONING_EFFORTS.forEach((effort) => expect(isValid(llmReasoningEffortType(effort))).toBe(true));
    expect(isValid(llmReasoningEffortType('max'))).toBe(false);
  });
});

describe('llmReasoningConfigType', () => {
  it('rejects an array', () => {
    expect(isValid(llmReasoningConfigType([]))).toBe(false);
  });
});

describe('llmModelTierValueType', () => {
  it('accepts a slug or a rich tier config', () => {
    expect(isValid(llmModelTierValueType('vendor/x'))).toBe(true);
    expect(isValid(llmModelTierValueType({ model: 'vendor/x', maxOutputTokens: 100, reasoning: { effort: 'low' } }))).toBe(true);
    expect(isValid(llmModelTierValueType({ model: 'vendor/x', maxOutputTokens: 1.5 }))).toBe(false);
  });
});

describe('derived types', () => {
  it('derive the effort union from LLM_REASONING_EFFORTS', () => {
    expectTypeOf<LlmReasoningEffort>().toEqualTypeOf<'low' | 'medium' | 'high'>();
    expectTypeOf<LlmReasoningConfig['effort']>().toEqualTypeOf<LlmReasoningEffort | undefined>();
  });

  it('are readonly', () => {
    const reasoning: { effort?: LlmReasoningEffort } = {};
    const tier: LlmModelTierConfig = { model: 'vendor/x', reasoning };
    // @ts-expect-error a derived declaration's fields are readonly
    tier.model = 'vendor/y';
    expect(tier.model).toBe('vendor/y');
  });
});
