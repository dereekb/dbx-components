import { describe, expect, it } from 'vitest';
import { MODEL_ARCHETYPES, MODEL_ARCHETYPE_SYNC_MODES, findModelArchetypeByAlias, getModelArchetypeBySlug, getModelArchetypesByAxisValue, getModelArchetypesByCollectionKind, getModelArchetypesBySyncMode, resolveModelArchetype } from './archetypes.js';

describe('model archetypes registry', () => {
  it('exposes the planned 17 archetypes plus 3 add-ons', () => {
    expect(MODEL_ARCHETYPES.length).toBe(24);
  });

  it('keeps slugs unique', () => {
    const slugs = new Set<string>();
    for (const a of MODEL_ARCHETYPES) {
      expect(slugs.has(a.slug), `duplicate slug ${a.slug}`).toBe(false);
      slugs.add(a.slug);
    }
  });

  it('keeps aliases unique across the catalog', () => {
    const aliasMap = new Map<string, string>();
    for (const a of MODEL_ARCHETYPES) {
      for (const alias of a.aliases) {
        const lower = alias.toLowerCase();
        expect(aliasMap.has(lower), `duplicate alias ${alias} on ${a.slug} (already owned by ${aliasMap.get(lower)})`).toBe(false);
        aliasMap.set(lower, a.slug);
      }
    }
  });

  it('resolves v3 slugs', () => {
    expect(getModelArchetypeBySlug('root-entity')?.slug).toBe('root-entity');
    expect(getModelArchetypeBySlug('denormalised-aggregate')?.slug).toBe('denormalised-aggregate');
  });

  it('resolves v1/v2 aliases (case-insensitive) to their v3 successors', () => {
    expect(findModelArchetypeByAlias('entity-private')?.slug).toBe('single-item-sub');
    expect(findModelArchetypeByAlias('PERMISSION-TABLE')?.slug).toBe('single-item-sub');
    expect(findModelArchetypeByAlias('digest')?.slug).toBe('denormalised-aggregate');
    expect(findModelArchetypeByAlias('temporal-summary')?.slug).toBe('denormalised-aggregate');
    expect(findModelArchetypeByAlias('hierarchical-registry')?.slug).toBe('reference-registry');
    expect(findModelArchetypeByAlias('subcollection-entity')?.slug).toBe('sub-collection-entity');
  });

  it('resolves both v3 slug and v1/v2 alias through resolveModelArchetype with viaAlias flag', () => {
    const v3 = resolveModelArchetype('root-entity');
    expect(v3?.viaAlias).toBe(false);
    expect(v3?.archetype.slug).toBe('root-entity');
    const alias = resolveModelArchetype('subcollection-entity');
    expect(alias?.viaAlias).toBe(true);
    expect(alias?.archetype.slug).toBe('sub-collection-entity');
  });

  it('returns archetypes filtered by sync mode', () => {
    const triggerEventual = getModelArchetypesBySyncMode('trigger-eventual');
    expect(triggerEventual.some((a) => a.slug === 'denormalised-aggregate')).toBe(true);
    expect(triggerEventual.some((a) => a.slug === 'root-singleton-aggregate')).toBe(true);
  });

  it('returns archetypes filtered by collection kind', () => {
    const singletons = getModelArchetypesByCollectionKind('root-singleton');
    expect(singletons.some((a) => a.slug === 'root-singleton-aggregate')).toBe(true);
    expect(singletons.some((a) => a.slug === 'system-state-singleton')).toBe(true);
  });

  it('returns archetypes filtered by axis value', () => {
    const subPurposePrivate = getModelArchetypesByAxisValue('subPurpose', 'private');
    expect(subPurposePrivate.some((a) => a.slug === 'single-item-sub')).toBe(true);
    const keyingBucket = getModelArchetypesByAxisValue('keying', 'bucket-code');
    expect(keyingBucket.some((a) => a.slug === 'denormalised-aggregate')).toBe(true);
  });

  it('exports the canonical sync-mode list', () => {
    expect(MODEL_ARCHETYPE_SYNC_MODES).toContain('always-in-sync');
    expect(MODEL_ARCHETYPE_SYNC_MODES).toContain('external-bidirectional');
  });
});
