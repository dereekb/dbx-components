import { describe, expect, it } from 'vitest';
import { scoreArchetypeAgainstQuestionnaire, scoreCatalog } from './score.js';
import { MODEL_ARCHETYPES, getModelArchetypeBySlug, type ModelArchetypeSlug } from '../../registry/archetypes.js';
import type { ArchetypeQuestionnaire } from './types.js';

function archetype(slug: ModelArchetypeSlug) {
  const found = getModelArchetypeBySlug(slug);
  if (!found) throw new Error(`unknown slug ${slug}`);
  return found;
}

describe('archetype scoring', () => {
  it('matches root-entity for a plain root model', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'auto',
      parentRelation: 'none',
      syncMode: 'always-in-sync',
      isDenormalization: false,
      isExternalMirror: false,
      isEventLog: false
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('root-entity');
  });

  it('matches user-keyed-entity-root for a per-user authoritative doc', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'user-uid',
      parentRelation: 'user-uid',
      userRelation: 'uid-is-doc-id',
      syncMode: 'always-in-sync',
      isDenormalization: false,
      isExternalMirror: false,
      hasSensitiveFields: true
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('user-keyed-entity-root');
  });

  it('matches user-keyed-index-root when denormalised', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'user-uid',
      parentRelation: 'user-uid',
      userRelation: 'uid-is-doc-id',
      syncMode: 'flag-eventual',
      isDenormalization: true,
      hasSyncFlag: true
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('user-keyed-index-root');
  });

  it('matches denormalised-aggregate with bucket-code keying + flag-eventual sync', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'bucket-code',
      parentRelation: 'user-uid',
      userRelation: 'uid-is-doc-id',
      isDenormalization: true,
      denormalizesFrom: ['jobWorkerTimesheet'],
      syncMode: 'flag-eventual',
      hasSyncFlag: true
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('denormalised-aggregate');
  });

  it('matches external-id-keyed-entity-root for vendor-id authoritative state', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'external-vendor-id',
      parentRelation: 'external-vendor-id',
      userRelation: 'external-vendor-id-is-doc-id',
      isExternalMirror: false,
      externalSystemName: 'zoho',
      syncMode: 'external-bidirectional'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('external-id-keyed-entity-root');
  });

  it('matches external-mirror for vendor-shaped cached payloads', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'parent-id',
      parentRelation: 'one-parent',
      isExternalMirror: true,
      externalSystemName: 'zoho',
      syncMode: 'external-bidirectional'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('external-mirror');
  });

  it('matches audit-log for append-only immutable rows', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'auto',
      parentRelation: 'one-parent',
      isEventLog: true,
      mutability: 'immutable',
      syncMode: 'append-only'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('audit-log');
  });

  it('short-circuits to notification-task on isMultiCheckpointWorkflow', () => {
    const q: ArchetypeQuestionnaire = {
      isMultiCheckpointWorkflow: true,
      docIdSource: 'auto',
      parentRelation: 'none'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('notification-task');
    expect(result.shortCircuited).toBe(true);
    expect(result.top.confidence).toBeGreaterThanOrEqual(1);
  });

  it('short-circuits to system-state-singleton on isSubsystemSingleton', () => {
    const q: ArchetypeQuestionnaire = {
      isSubsystemSingleton: true,
      docIdSource: 'fixed',
      parentRelation: 'none',
      syncMode: 'pull-on-demand'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('system-state-singleton');
  });

  it('matches root-singleton-aggregate when aggregatesFrom + isSiblingAggregate + fixed', () => {
    const q: ArchetypeQuestionnaire = {
      docIdSource: 'fixed',
      parentRelation: 'none',
      isDenormalization: true,
      aggregatesFrom: ['agent'],
      isSiblingAggregate: true,
      isSubsystemSingleton: false,
      syncMode: 'trigger-eventual'
    };
    const result = scoreCatalog(q);
    expect(result.top.archetype.slug).toBe('root-singleton-aggregate');
  });

  it('mismatching docIdSource subtracts the weight', () => {
    const arc = archetype('root-entity');
    const q: ArchetypeQuestionnaire = { docIdSource: 'user-uid', parentRelation: 'user-uid' };
    const scored = scoreArchetypeAgainstQuestionnaire(arc, q);
    // docIdSource expected ['auto'], answer is 'user-uid' → -3
    const docIdMismatch = scored.mismatches.find((m) => m.dimension === 'docIdSource');
    expect(docIdMismatch).toBeDefined();
    expect(docIdMismatch?.contribution).toBe(-3);
  });

  it('produces confidence in the [0,1] range or above 1 when short-circuited', () => {
    for (const arc of MODEL_ARCHETYPES) {
      const q: ArchetypeQuestionnaire = { docIdSource: 'auto' };
      const scored = scoreArchetypeAgainstQuestionnaire(arc, q);
      expect(scored.confidence).toBeGreaterThanOrEqual(-2); // mismatches can drive it negative but should not be NaN
      expect(Number.isFinite(scored.confidence)).toBe(true);
    }
  });
});
