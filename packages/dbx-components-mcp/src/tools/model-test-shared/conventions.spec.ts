/**
 * Spec for the spec-file naming-convention classifier.
 *
 * Verifies that each of the canonical buckets is recognised, that the four
 * drift shapes return a rename suggestion, and that the non-group /
 * non-spec edge cases short-circuit cleanly.
 */

import { describe, expect, it } from 'vitest';
import { buildCanonicalFilename, classifySpecFile, recommendBucketsForGroup, recommendSpecPath } from './conventions.js';

describe('classifySpecFile', () => {
  it('recognises a canonical `<group>.crud.spec.ts`', () => {
    const result = classifySpecFile({ filename: 'job.crud.spec.ts', parentFolderName: 'job' });
    expect(result.kind).toBe('crud');
    expect(result.isCanonical).toBe(true);
    expect(result.subgroups).toEqual([]);
    expect(result.recommendedRename).toBeUndefined();
  });

  it('recognises a canonical `<group>.crud.<sub>.spec.ts`', () => {
    const result = classifySpecFile({ filename: 'job.crud.requirement.spec.ts', parentFolderName: 'job' });
    expect(result.kind).toBe('crud-subgroup');
    expect(result.isCanonical).toBe(true);
    expect(result.subgroups).toEqual(['requirement']);
  });

  it('recognises a canonical `<group>.scenario.spec.ts`', () => {
    const result = classifySpecFile({ filename: 'notification.scenario.spec.ts', parentFolderName: 'notification' });
    expect(result.kind).toBe('scenario');
    expect(result.isCanonical).toBe(true);
  });

  it('recognises a deeply-nested canonical scenario-subgroup', () => {
    const result = classifySpecFile({ filename: 'job.scenario.requirement.worker.state.spec.ts', parentFolderName: 'job' });
    expect(result.kind).toBe('scenario-subgroup');
    expect(result.isCanonical).toBe(true);
    expect(result.subgroups).toEqual(['requirement', 'worker', 'state']);
  });

  it('flags a scenario-suffix drift and suggests the canonical rename', () => {
    const result = classifySpecFile({ filename: 'worker.payroll.scenario.spec.ts', parentFolderName: 'worker' });
    expect(result.kind).toBe('scenario-misplaced');
    expect(result.isCanonical).toBe(false);
    expect(result.subgroups).toEqual(['payroll']);
    expect(result.recommendedRename).toBe('worker.scenario.payroll.spec.ts');
  });

  it('flags a deeper scenario-suffix drift', () => {
    const result = classifySpecFile({ filename: 'school.job.publish.scenario.spec.ts', parentFolderName: 'school' });
    expect(result.kind).toBe('scenario-misplaced');
    expect(result.recommendedRename).toBe('school.scenario.job.publish.spec.ts');
  });

  it('flags a crud-suffix drift', () => {
    const result = classifySpecFile({ filename: 'worker.pay.crud.spec.ts', parentFolderName: 'worker' });
    expect(result.kind).toBe('crud-misplaced');
    expect(result.recommendedRename).toBe('worker.crud.pay.spec.ts');
  });

  it('flags a missing bucket and defaults to a scenario rename', () => {
    const result = classifySpecFile({ filename: 'worker.system.spec.ts', parentFolderName: 'worker' });
    expect(result.kind).toBe('no-bucket');
    expect(result.recommendedRename).toBe('worker.scenario.system.spec.ts');
  });

  it('marks files whose group prefix mismatches the folder as `non-group`', () => {
    const result = classifySpecFile({ filename: 'job.crud.spec.ts', parentFolderName: 'worker' });
    expect(result.kind).toBe('non-group');
    expect(result.isCanonical).toBe(false);
    expect(result.recommendedRename).toBeUndefined();
  });

  it('marks files without `.spec.ts` as `non-spec`', () => {
    const result = classifySpecFile({ filename: 'job.crud.ts', parentFolderName: 'job' });
    expect(result.kind).toBe('non-spec');
    expect(result.isCanonical).toBe(false);
  });
});

describe('buildCanonicalFilename', () => {
  it('renders the base bucket without subgroups', () => {
    expect(buildCanonicalFilename({ group: 'job', bucket: 'crud', subgroups: [] })).toBe('job.crud.spec.ts');
    expect(buildCanonicalFilename({ group: 'job', bucket: 'scenario', subgroups: [] })).toBe('job.scenario.spec.ts');
  });

  it('appends multi-segment subgroups in order', () => {
    expect(buildCanonicalFilename({ group: 'job', bucket: 'scenario', subgroups: ['requirement', 'worker'] })).toBe('job.scenario.requirement.worker.spec.ts');
  });
});

describe('recommendSpecPath', () => {
  it('renders the full canonical relative path', () => {
    const path = recommendSpecPath({ apiDir: 'apps/hellosubs-api', group: 'job', bucket: 'scenario', subgroups: ['requirement'] });
    expect(path).toBe('apps/hellosubs-api/src/app/function/job/job.scenario.requirement.spec.ts');
  });
});

describe('recommendBucketsForGroup', () => {
  it('returns both canonical buckets with rendered paths and summaries', () => {
    const recs = recommendBucketsForGroup({ apiDir: 'apps/hellosubs-api', group: 'worker' });
    expect(recs).toHaveLength(2);
    expect(recs[0].bucket).toBe('crud');
    expect(recs[0].canonicalPath).toBe('apps/hellosubs-api/src/app/function/worker/worker.crud.spec.ts');
    expect(recs[1].bucket).toBe('scenario');
    expect(recs[1].canonicalPath).toBe('apps/hellosubs-api/src/app/function/worker/worker.scenario.spec.ts');
    expect(recs[1].summary).toContain('worker.scenario.<sub>');
  });
});
