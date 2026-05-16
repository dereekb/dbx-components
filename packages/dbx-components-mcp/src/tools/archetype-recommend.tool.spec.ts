import { describe, expect, it } from 'vitest';
import { archetypeRecommendTool } from './archetype-recommend.tool.js';

async function runRecommend(args: Record<string, unknown>) {
  const result = await archetypeRecommendTool.run(args);
  const text = result.content.map((c) => c.text).join('\n');
  return { result, text };
}

describe('dbx_model_archetype_recommend', () => {
  it('returns user-keyed-entity-root for a per-user authoritative profile model', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'ExampleProfile',
        docIdSource: 'user-uid',
        parentRelation: 'user-uid',
        userRelation: 'uid-is-doc-id',
        isDenormalization: false,
        isExternalMirror: false,
        syncMode: 'always-in-sync',
        hasSensitiveFields: true,
        mutability: 'mutable'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `user-keyed-entity-root`');
    expect(text).toContain('collectionKind:** `root`');
  });

  it('returns denormalised-aggregate with keying=bucket-code for a worker payout week model', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'WorkerPayoutWeek',
        docIdSource: 'bucket-code',
        parentRelation: 'user-uid',
        userRelation: 'uid-is-doc-id',
        isDenormalization: true,
        denormalizesFrom: ['jobWorkerTimesheet'],
        syncMode: 'flag-eventual',
        hasSyncFlag: true,
        mutability: 'mutable',
        isExternalMirror: false,
        isEventLog: false
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `denormalised-aggregate`');
    expect(text).toContain('keying');
    expect(text).toContain('bucket-code');
  });

  it('returns root-singleton-aggregate for sibling-aggregating fixed-id singleton', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'ExampleAgentSummary',
        docIdSource: 'fixed',
        parentRelation: 'none',
        userRelation: 'none',
        isDenormalization: true,
        aggregatesFrom: ['agent'],
        isSiblingAggregate: true,
        isSubsystemSingleton: false,
        syncMode: 'trigger-eventual'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `root-singleton-aggregate`');
  });

  it('returns external-id-keyed-entity-root for vendor-id authoritative state', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'ExampleExternalInterview',
        docIdSource: 'external-vendor-id',
        parentRelation: 'external-vendor-id',
        userRelation: 'external-vendor-id-is-doc-id',
        isExternalMirror: false,
        externalSystemName: 'zoho',
        isEventLog: false,
        syncMode: 'external-bidirectional',
        hasLifecycleStates: true,
        hasSensitiveFields: true,
        mutability: 'mutable'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `external-id-keyed-entity-root`');
  });

  it('returns sub-collection-entity for an active counterpart of an archive split', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'ExamplePayStubArchive',
        docIdSource: 'auto',
        parentRelation: 'one-parent',
        parentModelType: 'worker',
        instancesPerParent: 'many',
        userRelation: 'references-user-key',
        isDenormalization: false,
        syncMode: 'append-only',
        mutability: 'immutable',
        hasArchiveCounterpart: true,
        archiveCounterpartName: 'workerPayStub'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Field-level add-ons');
    expect(text).toContain('active-vs-archive-split');
  });

  it('rejects malformed questionnaire input', async () => {
    const result = await archetypeRecommendTool.run({ questionnaire: 'not-an-object' });
    expect(result.isError).toBe(true);
  });
});
