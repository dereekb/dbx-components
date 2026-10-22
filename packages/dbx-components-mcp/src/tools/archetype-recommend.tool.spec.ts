import { describe, expect, it } from 'vitest';
import { ARCHETYPE_RECOMMEND_TOOL } from './archetype-recommend.tool.js';

async function runRecommend(args: Record<string, unknown>) {
  const result = await ARCHETYPE_RECOMMEND_TOOL.run(args);
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
    const result = await ARCHETYPE_RECOMMEND_TOOL.run({ questionnaire: 'not-an-object' });
    expect(result.isError).toBe(true);
  });

  it('flags both keying options when denormalised-aggregate is ambiguous under a user-keyed sub', async () => {
    // Per planning doc §8.6: when the doc id can legitimately be bucket-code
    // OR composite-flat-key, the recommender should render both rather than
    // silently picking one.
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'WorkerPayoutWeekAmbiguous',
        docIdSource: 'bucket-code',
        parentRelation: 'user-uid',
        userRelation: 'uid-is-doc-id',
        isDenormalization: true,
        denormalizesFrom: ['jobWorkerTimesheet'],
        syncMode: 'flag-eventual',
        hasSyncFlag: true,
        mutability: 'mutable'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `denormalised-aggregate`');
    expect(text).toContain('`bucket-code` OR `composite-flat-key`');
    expect(text).toContain('ambiguous');
  });

  it('does not flag ambiguity when keying is unambiguous', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'SchoolGroupSchoolSummary',
        docIdSource: 'parent-id',
        parentRelation: 'one-parent',
        parentModelType: 'schoolGroup',
        isDenormalization: true,
        denormalizesFrom: ['school'],
        syncMode: 'trigger-eventual',
        mutability: 'mutable'
      },
      scope: 'upstream'
    });
    expect(text).toContain('Recommended Archetype: `denormalised-aggregate`');
    expect(text).not.toContain('OR `composite-flat-key`');
    expect(text).not.toContain('OR `bucket-code`');
  });

  it('names unrecognized questionnaire keys and lists the accepted dimensions', async () => {
    const { text } = await runRecommend({
      questionnaire: { kind: 'root', idKind: 'uid', tenancy: 'workspace' },
      scope: 'upstream'
    });
    expect(text).toContain('Unrecognized questionnaire keys');
    expect(text).toContain('`kind`');
    expect(text).toContain('`idKind`');
    expect(text).toContain('`tenancy`');
    expect(text).toContain('`docIdSource`: `auto`');
    expect(text).toContain('`parentRelation`');
    expect(text).toContain('**boolean:**');
  });

  it('lists the accepted dimensions when nothing was answered', async () => {
    const { text } = await runRecommend({ questionnaire: {}, scope: 'upstream' });
    expect(text).toContain('No dimensions in the questionnaire were filled in');
    expect(text).toContain('`docIdSource`: `auto`');
  });

  it('exposes the questionnaire dimensions in the input schema', () => {
    const questionnaireSchema = (ARCHETYPE_RECOMMEND_TOOL.definition.inputSchema.properties as Record<string, { readonly properties?: Record<string, { readonly enum?: readonly string[] }> }>)['questionnaire'];
    expect(questionnaireSchema.properties?.['docIdSource']?.enum).toContain('composite-flat-key');
    expect(questionnaireSchema.properties?.['parentRelation']?.enum).toContain('user-uid');
  });

  it('lists composite-key-root for a composite-flat-key id', async () => {
    const { text } = await runRecommend({
      questionnaire: {
        candidateName: 'Project',
        docIdSource: 'composite-flat-key',
        parentRelation: 'user-uid',
        syncMode: 'always-in-sync'
      },
      scope: 'upstream',
      maxResults: 1
    });
    expect(text).toContain('`composite-key-root`');
    expect(text).not.toContain('Recommended Archetype: `notification-template`');
  });
});
