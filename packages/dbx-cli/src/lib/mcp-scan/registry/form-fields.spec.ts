import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, FORM_TIER_ORDER } from './index.js';

describe('FORM_FIELDS legacy data integrity', () => {
  it('exposes a non-empty list whose entries each carry a known tier', () => {
    expect(FORM_FIELDS.length).toBeGreaterThan(0);
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
});
