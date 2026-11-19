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

  it('throws on an empty or untrimmed slug', () => {
    expect(() => parseValue('')).toThrow(`MODEL_TIERS['fast'] must be a non-empty, trimmed model slug (got "").`);
    expect(() => parseValue(' vendor/x')).toThrow(`MODEL_TIERS['fast'] must be a non-empty, trimmed model slug (got " vendor/x").`);
    expect(() => parseValue('vendor/x ')).toThrow(/must be a non-empty, trimmed model slug/);
  });

  it('prefixes every message with the schema label when one is given', () => {
    expect(() => parseLlmModelTierValue({ schemaLabel: 'llm models', label: LABEL, tierKey: 'fast', value: '' })).toThrow(`llm models: MODEL_TIERS['fast'] must be a non-empty, trimmed model slug (got "").`);
    expect(() => parseLlmModelTierValue({ schemaLabel: 'llm models', label: LABEL, tierKey: 'fast', value: { model: 'm', x: 1 } })).toThrow(`llm models: MODEL_TIERS['fast'] has unknown key 'x'`);
    expect(() => parseLlmModelTierValue({ schemaLabel: 'llm models', label: LABEL, tierKey: 'fast', value: { model: 'm', maxOutputTokens: 1.5 } })).toThrow(`llm models: MODEL_TIERS['fast'].maxOutputTokens must be a positive integer (got 1.5).`);
  });

  it('treats an undefined field as absent and re-assembles in canonical key order', () => {
    const parsed = parseValue({ reasoning: { enabled: false, effort: 'low', exclude: undefined }, maxOutputTokens: undefined, model: 'm' });
    expect(parsed).toEqual({ model: 'm', reasoning: { effort: 'low', enabled: false } });
    expect(Object.keys(parsed)).toEqual(['model', 'reasoning']);
    expect(Object.keys(typeof parsed === 'string' ? {} : (parsed.reasoning ?? {}))).toEqual(['effort', 'enabled']);
  });

  it('throws on a value that is neither a string nor an object', () => {
    for (const value of [7, ['vendor/model-fast'], null]) {
      expect(() => parseValue(value)).toThrow(`MODEL_TIERS['fast'] must be a non-empty, trimmed model slug or a { model, maxOutputTokens?, reasoning? } object (got ${JSON.stringify(value)}).`);
    }
  });

  it('throws on an unknown config key', () => {
    expect(() => parseValue({ model: 'vendor/model-fast', maxTokens: 10 })).toThrow(`MODEL_TIERS['fast'] has unknown key 'maxTokens' (allowed: model, maxOutputTokens, reasoning).`);
  });

  it('throws on a missing or empty model', () => {
    expect(() => parseValue({ maxOutputTokens: 10 })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty, trimmed model slug (got undefined).`);
    expect(() => parseValue({ model: '' })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty, trimmed model slug (got "").`);
    expect(() => parseValue({ model: 'm ' })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty, trimmed model slug (got "m ").`);
  });

  it('throws on a maxOutputTokens that is not a positive integer', () => {
    const cases: ReadonlyArray<readonly [unknown, string]> = [
      [0, '0'],
      [-1, '-1'],
      [1.5, '1.5'],
      [Number.POSITIVE_INFINITY, 'Infinity'],
      ['10', '"10"']
    ];

    for (const [maxOutputTokens, got] of cases) {
      expect(() => parseValue({ model: 'm', maxOutputTokens })).toThrow(`MODEL_TIERS['fast'].maxOutputTokens must be a positive integer (got ${got}).`);
    }
  });

  it('reports the first failing field in key order', () => {
    expect(() => parseValue({ reasoning: { effort: 'max' }, maxOutputTokens: 0 })).toThrow(`MODEL_TIERS['fast'].model must be a non-empty, trimmed model slug (got undefined).`);
    expect(() => parseValue({ model: 'm', reasoning: { enabled: 1, effort: 'max' }, maxOutputTokens: 0 })).toThrow(`MODEL_TIERS['fast'].maxOutputTokens must be a positive integer (got 0).`);
    expect(() => parseValue({ model: 'm', reasoning: { enabled: 1, effort: 'max' } })).toThrow(`MODEL_TIERS['fast'].reasoning.effort must be one of low, medium, high (got "max").`);
  });

  it('throws when reasoning is not an object', () => {
    for (const reasoning of ['high', null, []]) {
      expect(() => parseValue({ model: 'm', reasoning })).toThrow(`MODEL_TIERS['fast'].reasoning must be an object (got ${JSON.stringify(reasoning)}).`);
    }
  });

  it('throws on an unknown reasoning key', () => {
    expect(() => parseValue({ model: 'm', reasoning: { budget: 1 } })).toThrow(`MODEL_TIERS['fast'].reasoning has unknown key 'budget' (allowed: effort, maxTokens, exclude, enabled).`);
  });

  it('throws on a bad effort band', () => {
    expect(() => parseValue({ model: 'm', reasoning: { effort: 'max' } })).toThrow(`MODEL_TIERS['fast'].reasoning.effort must be one of low, medium, high (got "max").`);
  });

  it('throws on a bad reasoning maxTokens', () => {
    expect(() => parseValue({ model: 'm', reasoning: { maxTokens: 0 } })).toThrow(`MODEL_TIERS['fast'].reasoning.maxTokens must be a positive integer (got 0).`);
    expect(() => parseValue({ model: 'm', reasoning: { maxTokens: 2.5 } })).toThrow(`MODEL_TIERS['fast'].reasoning.maxTokens must be a positive integer (got 2.5).`);
  });

  it('throws on a non-boolean exclude or enabled', () => {
    expect(() => parseValue({ model: 'm', reasoning: { exclude: 'yes' } })).toThrow(`MODEL_TIERS['fast'].reasoning.exclude must be a boolean (got "yes").`);
    expect(() => parseValue({ model: 'm', reasoning: { enabled: 1 } })).toThrow(`MODEL_TIERS['fast'].reasoning.enabled must be a boolean (got 1).`);
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
    expect(() => parseLlmModelTierMap({ label: LABEL, value: { fast: 'a/b', strong: '' } })).toThrow(`MODEL_TIERS['strong'] must be a non-empty, trimmed model slug (got "").`);
  });
});
