import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, FORM_TIER_ORDER, getFormField, getFormFields, getFormFieldsByProduces, getFormFieldsByTier, getFormFieldsByArrayOutput, getFormProducesCatalog } from './index.js';

describe('form-fields legacy fallback registry', () => {
  it('exposes a non-empty list whose entries each carry a known tier', () => {
    expect(FORM_FIELDS.length).toBeGreaterThan(0);
    expect(getFormFields()).toBe(FORM_FIELDS);
    const knownTiers = new Set<string>(FORM_TIER_ORDER);
    for (const field of FORM_FIELDS) {
      expect(knownTiers.has(field.tier), `${field.slug} has unknown tier ${field.tier}`).toBe(true);
    }
  });

  it('FORM_TIER_ORDER advertises all 5 canonical tiers', () => {
    expect(FORM_TIER_ORDER).toEqual(['field-factory', 'field-derivative', 'composite-builder', 'template-builder', 'primitive']);
  });

  it('gives every entry a unique slug', () => {
    const slugs = new Set<string>();
    for (const field of FORM_FIELDS) {
      expect(slugs.has(field.slug), `duplicate slug: ${field.slug}`).toBe(false);
      slugs.add(field.slug);
    }
  });

  it('gives every entry a produces value + arrayOutput in the known set', () => {
    const knownArray = new Set(['yes', 'no', 'optional']);
    for (const field of FORM_FIELDS) {
      expect(field.produces.length, `${field.slug} missing produces`).toBeGreaterThan(0);
      expect(knownArray.has(field.arrayOutput), `${field.slug} has unknown arrayOutput ${field.arrayOutput}`).toBe(true);
    }
  });

  it('primary index: getFormFieldsByProduces returns all entries for a value', () => {
    const strings = getFormFieldsByProduces('string');
    expect(strings.length).toBeGreaterThanOrEqual(2);
    expect(strings.every((f) => f.produces === 'string')).toBe(true);

    const rowFields = getFormFieldsByProduces('RowField');
    expect(rowFields.length).toBeGreaterThanOrEqual(2);
    const rowTiers = new Set(rowFields.map((f) => f.tier));
    expect(rowTiers.has('primitive'), 'primitive row missing').toBe(true);
    expect(rowTiers.has('composite-builder'), 'composite row missing').toBe(true);
  });

  it('produces catalog surfaces every distinct output primitive', () => {
    const catalog = getFormProducesCatalog();
    expect(catalog).toContain('string');
    expect(catalog).toContain('RowField');
    expect(new Set(catalog).size).toBe(catalog.length);
  });

  it('looks up fields by slug and case-insensitive factory name', () => {
    expect(getFormField('text')?.factoryName).toBe('dbxForgeTextField');
    expect(getFormField('DBXFORGETEXTFIELD')?.slug).toBe('text');
    expect(getFormField('not-a-real-field')).toBeUndefined();
  });

  it('filters by arrayOutput', () => {
    const nonArray = getFormFieldsByArrayOutput('no');
    expect(nonArray.length).toBeGreaterThan(0);
    expect(nonArray.every((f) => f.arrayOutput === 'no')).toBe(true);
  });

  it('field-factory and primitive tiers have entries in the fallback', () => {
    for (const tier of ['field-factory', 'primitive'] as const) {
      expect(getFormFieldsByTier(tier).length, `legacy fallback missing tier ${tier}`).toBeGreaterThan(0);
    }
  });
});
