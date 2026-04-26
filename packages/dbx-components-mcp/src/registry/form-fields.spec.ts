import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, FORM_TIER_ORDER, getFormField, getFormFields, getFormFieldsByProduces, getFormFieldsByTier, getFormFieldsByArrayOutput, getFormProducesCatalog, type FormTier } from './index.js';

// The static legacy registry only populates the original three tiers.
// `field-derivative` and `template-builder` are emitted by the manifest pipeline
// and become non-empty once the static array is cut over.
const LEGACY_POPULATED_TIERS: readonly FormTier[] = ['field-factory', 'composite-builder', 'primitive'];

describe('form-fields registry', () => {
  it('exposes a non-empty list and covers the legacy tiers', () => {
    expect(FORM_FIELDS.length).toBeGreaterThan(0);
    expect(getFormFields()).toBe(FORM_FIELDS);
    for (const tier of LEGACY_POPULATED_TIERS) {
      expect(getFormFieldsByTier(tier).length, `no entries for tier ${tier}`).toBeGreaterThan(0);
    }
    expect(FORM_TIER_ORDER).toContain('field-derivative');
    expect(FORM_TIER_ORDER).toContain('template-builder');
  });

  it('gives every entry a unique slug and a known tier', () => {
    const slugs = new Set<string>();
    const knownTiers = new Set<string>(FORM_TIER_ORDER);
    for (const field of FORM_FIELDS) {
      expect(slugs.has(field.slug), `duplicate slug: ${field.slug}`).toBe(false);
      slugs.add(field.slug);
      expect(knownTiers.has(field.tier), `unknown tier on ${field.slug}: ${field.tier}`).toBe(true);
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
});
