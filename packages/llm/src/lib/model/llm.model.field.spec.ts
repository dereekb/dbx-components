import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import {
  assertLlmModelConfigKeys,
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
  type LlmModelConfigFieldRules,
  llmModelOutputControlsOf,
  llmReasoningConfigOf,
  parseLlmModelConfigFields
} from './llm.model.field';
import { llmModelTierConfigType } from './llm.model.type';

const LABEL = `MODEL_TIERS['fast']`;

function parseTierConfig(value: Readonly<Record<string, unknown>>, schemaLabel?: string) {
  return parseLlmModelConfigFields({ schemaLabel, label: LABEL, value, type: llmModelTierConfigType, keys: LLM_MODEL_TIER_CONFIG_KEYS, rules: LLM_MODEL_TIER_CONFIG_FIELD_RULES });
}

describe('assertLlmModelConfigKeys()', () => {
  const retired = new Map([['old', 'Use `new` instead.']]);

  it('reports a retired key with its remedy before any unknown key', () => {
    expect(() => assertLlmModelConfigKeys({ label: 'x', entry: { typo: 1, old: 1 }, retired, allowed: ['new'] })).toThrow(`x has retired key 'old'. Use \`new\` instead.`);
  });

  it('reports an unknown key with the allowed list in order, prefixed by the schema label', () => {
    expect(() => assertLlmModelConfigKeys({ schemaLabel: 'llm models', label: 'x', entry: { typo: 1 }, allowed: ['b', 'a'] })).toThrow(`llm models: x has unknown key 'typo' (allowed: b, a).`);
  });

  it('only checks retired keys when no allowed list is given', () => {
    expect(() => assertLlmModelConfigKeys({ label: 'x', entry: { anything: 1 }, retired })).not.toThrow();
  });
});

describe('parseLlmModelConfigFields()', () => {
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

  it('returns only the declared keys for an extension type that deletes undeclared keys', () => {
    const speechType = type({ '+': 'delete', 'speech?': "'vendor-a' | 'vendor-b' | 'none'" });
    const rules: LlmModelConfigFieldRules<typeof speechType.infer> = { speech: { must: 'be one of vendor-a, vendor-b, none' } };
    const parsed = parseLlmModelConfigFields({ label: `providers['tts']`, value: { speech: 'vendor-a', transport: 'none' }, type: speechType, keys: ['speech'], rules });
    expect(parsed).toEqual({ speech: 'vendor-a' });
    expect(() => parseLlmModelConfigFields({ label: `providers['tts']`, value: { speech: 'vendor-z' }, type: speechType, keys: ['speech'], rules })).toThrow(`providers['tts'].speech must be one of vendor-a, vendor-b, none (got "vendor-z").`);
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
    expect(Object.keys(llmReasoningConfigOf({ enabled: true, effort: 'low' }))).toEqual(['effort', 'enabled']);
    expect(Object.keys(llmModelOutputControlsOf({ reasoning: { exclude: true }, maxOutputTokens: 10 }))).toEqual(['maxOutputTokens', 'reasoning']);
  });
});
