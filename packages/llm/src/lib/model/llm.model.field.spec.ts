import { parseArktypeFieldsWithMessages } from '@dereekb/model';
import { describe, expect, it } from 'vitest';
import {
  LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES,
  LLM_MODEL_OUTPUT_CONTROLS_KEYS,
  LLM_MODEL_PROVIDER_REF_FIELD_RULES,
  LLM_MODEL_PROVIDER_REF_KEYS,
  LLM_MODEL_SELECTION_FIELD_RULES,
  LLM_MODEL_SELECTION_KEYS,
  LLM_MODEL_TIER_CONFIG_FIELD_RULES,
  LLM_MODEL_TIER_CONFIG_KEYS,
  LLM_REASONING_CONFIG_FIELD_RULES,
  LLM_REASONING_CONFIG_KEYS,
  toCanonicalLlmModelOutputControls,
  toCanonicalLlmReasoningConfig
} from './llm.model.field';
import { llmModelOutputControlsType, llmModelTierConfigType, llmReasoningConfigType } from './llm.model.type';

const LABEL = `MODEL_TIERS['fast']`;

function parseTierConfig(value: Readonly<Record<string, unknown>>, schemaLabel?: string) {
  return parseArktypeFieldsWithMessages({ schemaLabel, label: LABEL, value, type: llmModelTierConfigType, keys: LLM_MODEL_TIER_CONFIG_KEYS, rules: LLM_MODEL_TIER_CONFIG_FIELD_RULES });
}

describe('parseArktypeFieldsWithMessages() with the tier-config rules', () => {
  it('reports the first failing field by key order, not by input order', () => {
    expect(() => parseTierConfig({ reasoning: 'high', maxOutputTokens: 0, model: '' })).toThrow(`${LABEL}.model must be a non-empty, trimmed model slug (got "").`);
    expect(() => parseTierConfig({ reasoning: 'high', maxOutputTokens: 0, model: 'vendor/x' })).toThrow(`${LABEL}.maxOutputTokens must be a positive integer (got 0).`);
  });

  it('renders the got value as JSON, and undefined / non-finite numbers by String', () => {
    expect(() => parseTierConfig({ model: 'vendor/x', maxOutputTokens: '10' })).toThrow(`(got "10").`);
    expect(() => parseTierConfig({ model: 'vendor/x', maxOutputTokens: { n: 1 } })).toThrow(`(got {"n":1}).`);
    expect(() => parseTierConfig({ model: 'vendor/x', maxOutputTokens: Infinity })).toThrow(`${LABEL}.maxOutputTokens must be a positive integer (got Infinity).`);
    expect(() => parseTierConfig({})).toThrow(`${LABEL}.model must be a non-empty, trimmed model slug (got undefined).`);
  });

  it('names the nested path of a failing nested field', () => {
    expect(() => parseTierConfig({ model: 'vendor/x', reasoning: { effort: 'max' } })).toThrow(`${LABEL}.reasoning.effort must be one of low, medium, high (got "max").`);
    expect(() => parseTierConfig({ model: 'vendor/x', reasoning: { exclude: true, maxTokens: 1.5 } })).toThrow(`${LABEL}.reasoning.maxTokens must be a positive integer (got 1.5).`);
  });

  it('fails loud on an unknown nested key', () => {
    expect(() => parseTierConfig({ model: 'vendor/x', reasoning: { effrot: 'low' } })).toThrow(`${LABEL}.reasoning has unknown key 'effrot' (allowed: effort, maxTokens, exclude, enabled).`);
  });

  it('treats an undefined value as absent, at the top level and nested', () => {
    expect(parseTierConfig({ model: 'vendor/x', maxOutputTokens: undefined, reasoning: { effort: undefined, enabled: false } })).toEqual({ model: 'vendor/x', reasoning: { enabled: false } });
  });

  it('prefixes every message with the schema label when one is given', () => {
    expect(() => parseTierConfig({ model: ' vendor/x' }, 'llm models')).toThrow(`llm models: ${LABEL}.model must be a non-empty, trimmed model slug (got " vendor/x").`);
  });
});

describe('field rule tables', () => {
  it('cover exactly their key lists, in order', () => {
    expect(Object.keys(LLM_REASONING_CONFIG_FIELD_RULES)).toEqual([...LLM_REASONING_CONFIG_KEYS]);
    expect(Object.keys(LLM_MODEL_OUTPUT_CONTROLS_FIELD_RULES)).toEqual([...LLM_MODEL_OUTPUT_CONTROLS_KEYS]);
    expect(Object.keys(LLM_MODEL_SELECTION_FIELD_RULES)).toEqual([...LLM_MODEL_SELECTION_KEYS]);
    expect(Object.keys(LLM_MODEL_PROVIDER_REF_FIELD_RULES)).toEqual([...LLM_MODEL_PROVIDER_REF_KEYS]);
    expect(Object.keys(LLM_MODEL_TIER_CONFIG_FIELD_RULES)).toEqual([...LLM_MODEL_TIER_CONFIG_KEYS]);
  });
});

describe('canonical assembly', () => {
  it('re-assembles reasoning and output controls in key order, dropping absent keys', () => {
    expect(Object.keys(toCanonicalLlmReasoningConfig({ enabled: true, effort: 'low' }))).toEqual(['effort', 'enabled']);
    expect(Object.keys(toCanonicalLlmModelOutputControls({ reasoning: { exclude: true }, maxOutputTokens: 10 }))).toEqual(['maxOutputTokens', 'reasoning']);
  });
});

describe('the arktype prop order the key lists do not derive from', () => {
  // The canary of the four-representation decision in `llm.model.field.ts`: arktype sorts optional props, so a key list
  // read off a type would reorder the first reported failure and the written key order. If this starts failing, the
  // `*_KEYS` lists may be derivable from the types.
  it('should read the optional props of a type back sorted, not in the canonical key order', () => {
    const propsOf = (props: ReadonlyArray<{ readonly key: unknown }>) => props.map((prop) => String(prop.key));

    expect(propsOf(llmReasoningConfigType.props)).toEqual(['effort', 'enabled', 'exclude', 'maxTokens']);
    expect(propsOf(llmReasoningConfigType.props)).not.toEqual([...LLM_REASONING_CONFIG_KEYS]);
    expect(propsOf(llmModelOutputControlsType.props)).toEqual([...LLM_MODEL_OUTPUT_CONTROLS_KEYS]);
    expect(propsOf(llmModelTierConfigType.props)).toEqual(['model', 'maxOutputTokens', 'reasoning']);
  });
});
