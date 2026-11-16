import { describe, expect, it } from 'vitest';
import { parseLlmModelTierMap, parseLlmModelTierValue } from './llm.model.tier.parse';

const LABEL = 'MODEL_TIERS';

function parseValue(value: unknown) {
  return parseLlmModelTierValue({ label: LABEL, tierKey: 'fast', value });
}

describe('parseLlmModelTierValue()', () => {
  it('parses a bare slug', () => {
    expect(parseValue('vendor/model-fast')).toBe('vendor/model-fast');
  });

  it('round-trips a rich config', () => {
    const config = { model: 'vendor/model-fast', maxOutputTokens: 8_192, reasoning: { effort: 'low', maxTokens: 512, exclude: true, enabled: false } };
    expect(parseValue(config)).toEqual(config);
  });

  it('omits the absent optional fields', () => {
    expect(parseValue({ model: 'vendor/model-fast' })).toEqual({ model: 'vendor/model-fast' });
  });

  it('throws on an empty slug', () => {
    expect(() => parseValue('')).toThrow(`MODEL_TIERS['fast'] must be a non-empty model-slug string.`);
  });

  it('throws on a value that is neither a string nor an object', () => {
    for (const value of [7, ['vendor/model-fast'], null]) {
      expect(() => parseValue(value)).toThrow(`MODEL_TIERS['fast'] must be a non-empty model-slug string or a { model, maxOutputTokens?, reasoning? } object.`);
    }
  });

  it('throws on an unknown config key', () => {
    expect(() => parseValue({ model: 'vendor/model-fast', maxTokens: 10 })).toThrow(`MODEL_TIERS['fast'] has unknown key 'maxTokens' (allowed: model, maxOutputTokens, reasoning).`);
  });

  it('throws on a missing or empty model', () => {
    expect(() => parseValue({ maxOutputTokens: 10 })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty model-slug string.`);
    expect(() => parseValue({ model: '' })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty model-slug string.`);
  });

  it('throws on a non-positive or non-finite maxOutputTokens', () => {
    for (const maxOutputTokens of [0, -1, Number.POSITIVE_INFINITY, '10']) {
      expect(() => parseValue({ model: 'm', maxOutputTokens })).toThrow(`MODEL_TIERS['fast'].maxOutputTokens must be a positive number.`);
    }
  });

  it('throws when reasoning is not an object', () => {
    for (const reasoning of ['high', null, []]) {
      expect(() => parseValue({ model: 'm', reasoning })).toThrow(`MODEL_TIERS['fast'].reasoning must be an object.`);
    }
  });

  it('throws on an unknown reasoning key', () => {
    expect(() => parseValue({ model: 'm', reasoning: { budget: 1 } })).toThrow(`MODEL_TIERS['fast'].reasoning has unknown key 'budget' (allowed: effort, maxTokens, exclude, enabled).`);
  });

  it('throws on a bad effort band', () => {
    expect(() => parseValue({ model: 'm', reasoning: { effort: 'max' } })).toThrow(`MODEL_TIERS['fast'].reasoning.effort must be one of low | medium | high.`);
  });

  it('throws on a bad reasoning maxTokens', () => {
    expect(() => parseValue({ model: 'm', reasoning: { maxTokens: 0 } })).toThrow(`MODEL_TIERS['fast'].reasoning.maxTokens must be a positive number.`);
  });

  it('throws on a non-boolean exclude or enabled', () => {
    expect(() => parseValue({ model: 'm', reasoning: { exclude: 'yes' } })).toThrow(`MODEL_TIERS['fast'].reasoning.exclude must be a boolean.`);
    expect(() => parseValue({ model: 'm', reasoning: { enabled: 1 } })).toThrow(`MODEL_TIERS['fast'].reasoning.enabled must be a boolean.`);
  });
});

describe('parseLlmModelTierMap()', () => {
  it('throws on a non-object top level', () => {
    for (const value of ['fast', [], null]) {
      expect(() => parseLlmModelTierMap({ label: LABEL, value })).toThrow(`MODEL_TIERS must be a JSON object of { tierKey: modelSlug | { model, maxOutputTokens?, reasoning? } }.`);
    }
  });

  it('parses an empty object to an empty map', () => {
    expect(parseLlmModelTierMap({ label: LABEL, value: {} })).toEqual({});
  });

  it('parses every entry', () => {
    expect(parseLlmModelTierMap({ label: LABEL, value: { fast: 'a/b', strong: { model: 'c/d' } } })).toEqual({ fast: 'a/b', strong: { model: 'c/d' } });
  });

  it('names the tier key of a bad entry', () => {
    expect(() => parseLlmModelTierMap({ label: LABEL, value: { fast: 'a/b', strong: '' } })).toThrow(`MODEL_TIERS['strong'] must be a non-empty model-slug string.`);
  });
});
