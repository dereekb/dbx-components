import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { type ArktypeFieldRules, assertObjectKeys, parseArktypeFieldsWithMessages, schemaLabelMessagePrefix } from './type.field';

const optionsType = type({ 'mode?': "'fast' | 'slow'", 'limit?': 'number.integer > 0', 'exclude?': 'boolean' }).readonly();
const widgetType = type({ name: type('string.trim.preformatted').atLeastLength(1), 'size?': 'number.integer > 0', 'options?': optionsType }).readonly();

const OPTIONS_KEYS = ['mode', 'limit', 'exclude'] as const;
const WIDGET_KEYS = ['name', 'size', 'options'] as const;

const WIDGET_RULES: ArktypeFieldRules<typeof widgetType.infer> = {
  name: { must: 'be a non-empty, trimmed name' },
  size: { must: 'be a positive integer', remedy: 'Remove the key to use the default size.' },
  options: { must: 'be an object', fields: { mode: { must: 'be one of fast, slow' }, limit: { must: 'be a positive integer' }, exclude: { must: 'be a boolean' } }, keys: OPTIONS_KEYS }
};

const LABEL = 'widget';

function parseWidget(value: Readonly<Record<string, unknown>>, schemaLabel?: string) {
  return parseArktypeFieldsWithMessages({ schemaLabel, label: LABEL, value, type: widgetType, keys: WIDGET_KEYS, rules: WIDGET_RULES });
}

describe('schemaLabelMessagePrefix()', () => {
  it('returns the label followed by a colon and a space', () => {
    expect(schemaLabelMessagePrefix('x')).toBe('x: ');
  });

  it('returns an empty prefix for no label', () => {
    expect(schemaLabelMessagePrefix(undefined)).toBe('');
    expect(schemaLabelMessagePrefix(null)).toBe('');
    expect(schemaLabelMessagePrefix('')).toBe('');
  });
});

describe('assertObjectKeys()', () => {
  const retired = new Map([['old', 'Use `new` instead.']]);

  it('reports a retired key with its remedy before any unknown key', () => {
    expect(() => assertObjectKeys({ label: 'x', entry: { typo: 1, old: 1 }, retired, allowed: ['new'] })).toThrow(`x has retired key 'old'. Use \`new\` instead.`);
  });

  it('reports an unknown key with the allowed list in order, prefixed by the schema label', () => {
    expect(() => assertObjectKeys({ schemaLabel: 'my-app config', label: 'x', entry: { typo: 1 }, allowed: ['b', 'a'] })).toThrow(`my-app config: x has unknown key 'typo' (allowed: b, a).`);
  });

  it('only checks retired keys when no allowed list is given', () => {
    expect(() => assertObjectKeys({ label: 'x', entry: { anything: 1 }, retired })).not.toThrow();
  });
});

describe('parseArktypeFieldsWithMessages()', () => {
  it('reports the first failing field by key order, not by input order', () => {
    expect(() => parseWidget({ options: 'x', size: 0, name: '' })).toThrow(`${LABEL}.name must be a non-empty, trimmed name (got "").`);
    expect(() => parseWidget({ options: 'x', size: 0, name: 'a' })).toThrow(`${LABEL}.size must be a positive integer (got 0). Remove the key to use the default size.`);
  });

  it('renders the got value as JSON, and undefined / non-finite numbers by String', () => {
    expect(() => parseWidget({ name: 'a', size: '10' })).toThrow(`(got "10").`);
    expect(() => parseWidget({ name: 'a', size: { n: 1 } })).toThrow(`(got {"n":1}).`);
    expect(() => parseWidget({ name: 'a', size: Infinity })).toThrow(`${LABEL}.size must be a positive integer (got Infinity).`);
    expect(() => parseWidget({})).toThrow(`${LABEL}.name must be a non-empty, trimmed name (got undefined).`);
  });

  it('names the nested path of a failing nested field', () => {
    expect(() => parseWidget({ name: 'a', options: { mode: 'max' } })).toThrow(`${LABEL}.options.mode must be one of fast, slow (got "max").`);
    expect(() => parseWidget({ name: 'a', options: { exclude: true, limit: 1.5 } })).toThrow(`${LABEL}.options.limit must be a positive integer (got 1.5).`);
  });

  it('fails loud on an unknown nested key', () => {
    expect(() => parseWidget({ name: 'a', options: { mdoe: 'fast' } })).toThrow(`${LABEL}.options has unknown key 'mdoe' (allowed: mode, limit, exclude).`);
  });

  it('treats an undefined value as absent, at the top level and nested', () => {
    expect(parseWidget({ name: 'a', size: undefined, options: { mode: undefined, exclude: false } })).toEqual({ name: 'a', options: { exclude: false } });
  });

  it('prefixes every message with the schema label when one is given', () => {
    expect(() => parseWidget({ name: ' a' }, 'my-app config')).toThrow(`my-app config: ${LABEL}.name must be a non-empty, trimmed name (got " a").`);
  });

  it('returns only the declared keys for an extension type that deletes undeclared keys', () => {
    const flavorType = type({ '+': 'delete', 'flavor?': "'sweet' | 'sour' | 'none'" });
    const rules: ArktypeFieldRules<typeof flavorType.infer> = { flavor: { must: 'be one of sweet, sour, none' } };
    const parsed = parseArktypeFieldsWithMessages({ label: `widgets['snack']`, value: { flavor: 'sweet', color: 'red' }, type: flavorType, keys: ['flavor'], rules });
    expect(parsed).toEqual({ flavor: 'sweet' });
    expect(() => parseArktypeFieldsWithMessages({ label: `widgets['snack']`, value: { flavor: 'bitter' }, type: flavorType, keys: ['flavor'], rules })).toThrow(`widgets['snack'].flavor must be one of sweet, sour, none (got "bitter").`);
  });

  it('falls back to the label and arktype summary for an error outside the checked keys', () => {
    const strictType = type({ '+': 'reject', 'flavor?': 'string' });
    const rules: ArktypeFieldRules<typeof strictType.infer> = { flavor: { must: 'be a string' } };
    expect(() => parseArktypeFieldsWithMessages({ label: LABEL, value: { flavor: 'sweet', color: 'red' }, type: strictType, keys: ['flavor'], rules })).toThrow(/^widget /);
  });
});
