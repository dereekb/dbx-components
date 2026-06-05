import { describe, it, expect } from 'vitest';
import { parseModelSizeProfile, ModelSizeProfileError, FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES, DEFAULT_MODEL_SIZE_DEFAULTS } from './model-size.profile';

describe('parseModelSizeProfile', () => {
  it('fills defaults for a minimal profile', () => {
    const profile = parseModelSizeProfile({ source: './x.ts' });

    expect(profile.source).toBe('./x.ts');
    expect(profile.export).toBeUndefined();
    expect(profile.limitBytes).toBe(FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES);
    expect(profile.includeOptional).toBe(true);
    expect(profile.defaults).toEqual(DEFAULT_MODEL_SIZE_DEFAULTS);
    expect(profile.fields).toEqual({});
    expect(profile.solveFor).toBeUndefined();
  });

  it('reads explicit values and merges partial defaults', () => {
    const profile = parseModelSizeProfile({
      source: './x.ts',
      export: 'fooConverter',
      limitBytes: 500,
      includeOptional: false,
      defaults: { string: 8 },
      fields: { name: 40, 'entries[]': 10 },
      solveFor: 'entries[]'
    });

    expect(profile.export).toBe('fooConverter');
    expect(profile.limitBytes).toBe(500);
    expect(profile.includeOptional).toBe(false);
    expect(profile.defaults.string).toBe(8);
    expect(profile.defaults.arrayCount).toBe(DEFAULT_MODEL_SIZE_DEFAULTS.arrayCount);
    expect(profile.fields['entries[]']).toBe(10);
    expect(profile.solveFor).toBe('entries[]');
  });

  it('throws when source is missing', () => {
    expect(() => parseModelSizeProfile({})).toThrow(ModelSizeProfileError);
  });

  it('throws when a field size is negative or non-numeric', () => {
    expect(() => parseModelSizeProfile({ source: './x.ts', fields: { name: -1 } })).toThrow(ModelSizeProfileError);
    expect(() => parseModelSizeProfile({ source: './x.ts', fields: { name: 'big' } })).toThrow(ModelSizeProfileError);
  });

  it('throws when the top-level value is not an object', () => {
    expect(() => parseModelSizeProfile('nope')).toThrow(ModelSizeProfileError);
  });
});
