import { describe, expect, it } from 'vitest';
import { FORGE_FIELDS, FORGE_TIER_ORDER, getForgeField, getForgeFields, getForgeFieldsByProduces, getForgeFieldsByTier, getForgeFieldsByArrayOutput, getForgeProducesCatalog } from './index.js';

describe('forge-fields registry', () => {
  it('exposes a non-empty list and covers all three tiers', () => {
    expect(FORGE_FIELDS.length).toBeGreaterThan(0);
    expect(getForgeFields()).toBe(FORGE_FIELDS);
    for (const tier of FORGE_TIER_ORDER) {
      expect(getForgeFieldsByTier(tier).length, `no entries for tier ${tier}`).toBeGreaterThan(0);
    }
  });

  it('gives every entry a unique slug and a known tier', () => {
    const slugs = new Set<string>();
    const knownTiers = new Set<string>(FORGE_TIER_ORDER);
    for (const field of FORGE_FIELDS) {
      expect(slugs.has(field.slug), `duplicate slug: ${field.slug}`).toBe(false);
      slugs.add(field.slug);
      expect(knownTiers.has(field.tier), `unknown tier on ${field.slug}: ${field.tier}`).toBe(true);
    }
  });

  it('gives every entry a produces value + arrayOutput in the known set', () => {
    const knownArray = new Set(['yes', 'no', 'optional']);
    for (const field of FORGE_FIELDS) {
      expect(field.produces.length, `${field.slug} missing produces`).toBeGreaterThan(0);
      expect(knownArray.has(field.arrayOutput), `${field.slug} has unknown arrayOutput ${field.arrayOutput}`).toBe(true);
    }
  });

  it('primary index: getForgeFieldsByProduces returns all entries for a value', () => {
    const strings = getForgeFieldsByProduces('string');
    expect(strings.length).toBeGreaterThanOrEqual(2);
    expect(strings.every((f) => f.produces === 'string')).toBe(true);

    const rowFields = getForgeFieldsByProduces('RowField');
    expect(rowFields.length).toBeGreaterThanOrEqual(2);
    const rowTiers = new Set(rowFields.map((f) => f.tier));
    expect(rowTiers.has('primitive'), 'primitive row missing').toBe(true);
    expect(rowTiers.has('composite-builder'), 'composite row missing').toBe(true);
  });

  it('produces catalog surfaces every distinct output primitive', () => {
    const catalog = getForgeProducesCatalog();
    expect(catalog).toContain('string');
    expect(catalog).toContain('RowField');
    expect(new Set(catalog).size).toBe(catalog.length);
  });

  it('looks up fields by slug and case-insensitive factory name', () => {
    expect(getForgeField('text')?.factoryName).toBe('dbxForgeTextField');
    expect(getForgeField('DBXFORGETEXTFIELD')?.slug).toBe('text');
    expect(getForgeField('not-a-real-field')).toBeUndefined();
  });

  it('filters by arrayOutput', () => {
    const nonArray = getForgeFieldsByArrayOutput('no');
    expect(nonArray.length).toBeGreaterThan(0);
    expect(nonArray.every((f) => f.arrayOutput === 'no')).toBe(true);
  });
});
