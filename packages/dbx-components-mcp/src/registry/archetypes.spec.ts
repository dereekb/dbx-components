import { describe, expect, it } from 'vitest';
import { MODEL_ARCHETYPES, MODEL_ARCHETYPE_SYNC_MODES, getModelArchetypeBySlug, getModelArchetypesByAxisValue, getModelArchetypesByCollectionKind, getModelArchetypesBySyncMode, resolveModelArchetype } from './archetypes.js';

describe('model archetypes registry', () => {
  it('exposes the planned primary archetypes plus 3 add-ons', () => {
    // 21 primary archetypes (incl. lifecycle-item + model-tree-node) + 3 add-ons.
    expect(MODEL_ARCHETYPES.length).toBe(24);
  });

  it('keeps slugs unique', () => {
    const slugs = new Set<string>();
    for (const a of MODEL_ARCHETYPES) {
      expect(slugs.has(a.slug), `duplicate slug ${a.slug}`).toBe(false);
      slugs.add(a.slug);
    }
  });

  it('resolves slugs', () => {
    expect(getModelArchetypeBySlug('root-entity')?.slug).toBe('root-entity');
    expect(getModelArchetypeBySlug('denormalised-aggregate')?.slug).toBe('denormalised-aggregate');
  });

  it('resolves slugs case-insensitively through resolveModelArchetype', () => {
    expect(resolveModelArchetype('root-entity')?.archetype.slug).toBe('root-entity');
    expect(resolveModelArchetype('ROOT-ENTITY')?.archetype.slug).toBe('root-entity');
    expect(resolveModelArchetype('not-a-slug')).toBeUndefined();
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
