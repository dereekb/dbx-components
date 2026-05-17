/**
 * Vitest specs for the model-firebase-index extractor.
 *
 * Composes in-memory ts-morph projects containing both
 * `firestoreModelIdentity(...)` declarations (for the identity resolver) and
 * `@dbxModelFirebaseIndex`-tagged factories with realistic constraint
 * sequences. Covers:
 *  - Marker opt-in (no `@dbxModelFirebaseIndex` → not extracted).
 *  - Required `@dbxModelFirebaseIndexModel <Type>` tag.
 *  - Scope default for nested vs. root models.
 *  - Conditional branches feeding constraints in source order (v1 = single
 *    flattened sequence, branches not enumerated).
 *  - `@dbxModelFirebaseIndexSkip` → empty constraintSequences.
 *  - Duplicate-slug detection.
 */

import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { extractModelFirebaseIndexEntries } from './model-firebase-index-extract.js';
import { buildIdentityResolverFromProject } from './firestore-model-identity-resolver.js';

function projectWith(files: Record<string, string>): Project {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const [path, contents] of Object.entries(files)) {
    project.createSourceFile(path, contents, { overwrite: true });
  }
  return project;
}

const IDENTITY_FIXTURE = `
  export const jobIdentity = firestoreModelIdentity('job', 'j');
  export const jobLocationIdentity = firestoreModelIdentity(jobIdentity, 'jobLocation', 'jl');
  export const jobLocationWeekIdentity = firestoreModelIdentity(jobLocationIdentity, 'jobLocationWeek', 'jlw');
  function firestoreModelIdentity(...args: unknown[]): { collection: string } {
    return { collection: 'stub' };
  }
`;

describe('extractModelFirebaseIndexEntries — marker opt-in', () => {
  it('skips functions without @dbxModelFirebaseIndex', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        /** Untagged factory. */
        export function jobUntaggedQuery(): unknown[] {
          return [];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries).toEqual([]);
  });

  it('warns when the marker is present but @dbxModelFirebaseIndexModel is missing', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        /**
         * Missing model tag.
         * @dbxModelFirebaseIndex
         */
        export function brokenQuery(): unknown[] {
          return [];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries).toEqual([]);
    expect(result.warnings.find((w) => w.kind === 'missing-model-tag')).toBeDefined();
  });

  it('warns when the model name cannot be resolved', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/unknown/unknown.query.ts': `
        /**
         * Unknown model.
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel TotallyUnknownType
         */
        export function unknownQuery(): unknown[] {
          return [];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries).toEqual([]);
    expect(result.warnings.find((w) => w.kind === 'unresolved-model')).toBeDefined();
  });
});

describe('extractModelFirebaseIndexEntries — scope defaults', () => {
  it('defaults to COLLECTION_GROUP for nested models', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): unknown { return {}; }
        type JobLocationWeek = { jdds: string; w: number };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel JobLocationWeek
         */
        export function nestedDefaultQuery(): unknown[] {
          return [
            where<JobLocationWeek>('jdds', '==', 'foo'),
            orderBy<JobLocationWeek>('w', 'asc')
          ];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.collection).toBe('jlw');
    expect(entry.isNested).toBe(true);
    expect(entry.scope).toBe('COLLECTION_GROUP');
  });

  it('defaults to COLLECTION for root models', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function rootDefaultQuery(): unknown[] {
          return [where<Job>('status', '==', 'active')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.collection).toBe('j');
    expect(entry.isNested).toBe(false);
    expect(entry.scope).toBe('COLLECTION');
  });

  it('explicit @dbxModelFirebaseIndexScope tag overrides the default', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexScope COLLECTION_GROUP
         */
        export function forcedCollectionGroupQuery(): unknown[] {
          return [where<Job>('status', '==', 'active')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries[0].scope).toBe('COLLECTION_GROUP');
  });
});

describe('extractModelFirebaseIndexEntries — flags + constraints', () => {
  it('extracts the constraint sequence in source order', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): unknown { return {}; }
        type JobLocationWeek = { jdds: string; w: number };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel JobLocationWeek
         */
        export function dirtyForSyncQuery(): unknown[] {
          return [
            where<JobLocationWeek>('jdds', '==', 'foo'),
            where<JobLocationWeek>('w', '>=', 0),
            where<JobLocationWeek>('w', '<=', 100),
            orderBy<JobLocationWeek>('w', 'asc')
          ];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    const sequence = result.entries[0].constraintSequences[0];
    expect(sequence.entries.length).toBe(4);
    expect(sequence.entries[0]).toMatchObject({ kind: 'where', fieldPath: 'jdds', operator: '==' });
    expect(sequence.entries[1]).toMatchObject({ kind: 'where', fieldPath: 'w', operator: '>=' });
    expect(sequence.entries[2]).toMatchObject({ kind: 'where', fieldPath: 'w', operator: '<=' });
    expect(sequence.entries[3]).toMatchObject({ kind: 'orderBy', fieldPath: 'w', direction: 'asc' });
  });

  it('emits empty constraintSequences when @dbxModelFirebaseIndexSkip is set', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexSkip
         */
        export function skipQuery(): unknown[] {
          return [where<Job>('status', '==', 'active')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].skip).toBe(true);
    expect(result.entries[0].constraintSequences).toEqual([]);
  });

  it('keeps constraintSequences populated but emits excluded-factory warning when @dbxModelFirebaseIndexExclude is set', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): unknown { return {}; }
        type Job = { status: string; dat: number };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexExclude
         */
        export function excludedQuery(): unknown[] {
          return [where<Job>('status', '==', 'active'), orderBy<Job>('dat', 'asc')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].excluded).toBe(true);
    expect(result.entries[0].skip).toBe(false);
    expect(result.entries[0].constraintSequences.length).toBe(1);
    expect(result.entries[0].constraintSequences[0].entries.length).toBe(2);
    const warning = result.warnings.find((w) => w.kind === 'excluded-factory');
    expect(warning).toBeDefined();
    if (warning?.kind === 'excluded-factory') {
      expect(warning.severity).toBe('warning');
      expect(warning.name).toBe('excludedQuery');
    }
  });

  it('defaults excluded to false when @dbxModelFirebaseIndexExclude is absent', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function normalQuery(): unknown {
          return where<Job>('status', '==', 'active');
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].excluded).toBe(false);
    expect(result.warnings.find((w) => w.kind === 'excluded-factory')).toBeUndefined();
  });

  it('lets @dbxModelFirebaseIndexSkip suppress constraints even when @dbxModelFirebaseIndexExclude is also present', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexSkip
         * @dbxModelFirebaseIndexExclude
         */
        export function skipAndExcludedQuery(): unknown[] {
          return [where<Job>('status', '==', 'active')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].skip).toBe(true);
    expect(result.entries[0].excluded).toBe(true);
    expect(result.entries[0].constraintSequences).toEqual([]);
    expect(result.warnings.find((w) => w.kind === 'excluded-factory')).toBeDefined();
  });

  it('parses @dbxModelFirebaseIndexAllowArrayContainsAny as allowArrayContainsAny = true', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { jw: string[] };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexAllowArrayContainsAny
         */
        export function jobsWithAnyWeek(weeks: string[]): unknown {
          return where<Job>('jw', 'array-contains-any', weeks);
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].allowArrayContainsAny).toBe(true);
  });

  it('defaults allowArrayContainsAny to false when the tag is absent', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function defaultQuery(): unknown {
          return where<Job>('status', '==', 'active');
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].allowArrayContainsAny).toBe(false);
  });

  it('errors with complex-query-body when constraints sit inside if-branches', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dynamic.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string; pr: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobDynamicQuery(state?: string, payroll?: string): unknown[] {
          const out: unknown[] = [];
          if (state != null) out.push(where<Job>('s', '==', state));
          if (payroll != null) out.push(where<Job>('pr', '==', payroll));
          return out;
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'complex-query-body');
    expect(error).toBeDefined();
    if (error?.kind === 'complex-query-body') {
      expect(error.severity).toBe('error');
      expect(error.branchKind).toBe('if');
      expect(error.name).toBe('jobDynamicQuery');
    }
    // Constraint extraction is skipped on a structural failure.
    expect(result.entries[0].constraintSequences).toEqual([]);
  });

  it('uses one constraint sequence per @dbxModelFirebaseIndexPath tag, filtered to listed fields', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dynamic.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string; sy: boolean; pr: string; bat: Date };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexPath s, sy
         * @dbxModelFirebaseIndexPath pr, s
         * @dbxModelFirebaseIndexPath s, pr, sy
         */
        export function jobDynamicQuery(state: string, sy: boolean, payroll: string, bat: Date): unknown[] {
          return [
            where<Job>('s', '==', state),
            where<Job>('sy', '==', sy),
            where<Job>('pr', '==', payroll),
            where<Job>('bat', '<=', bat)
          ];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'missing-paths')).toBeUndefined();
    const entry = result.entries[0];
    expect(entry.constraintSequences.length).toBe(3);
    expect(entry.constraintSequences.map((s) => s.pathLabel)).toEqual(['s,sy', 'pr,s', 's,pr,sy']);
    // Each sequence preserves tag-declared order so authors can match an
    // already-deployed index whose field order differs from the body.
    expect(entry.constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['s', 'sy']);
    expect(entry.constraintSequences[1].entries.map((e) => e.fieldPath)).toEqual(['pr', 's']);
    expect(entry.constraintSequences[2].entries.map((e) => e.fieldPath)).toEqual(['s', 'pr', 'sy']);
  });

  it('warns unknown-path-field when @dbxModelFirebaseIndexPath references a field the body never produces', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dynamic.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexPath s, nope
         */
        export function jobDynamicQuery(state: string): unknown[] {
          return [where<Job>('s', '==', state)];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const warning = result.warnings.find((w) => w.kind === 'unknown-path-field');
    expect(warning).toBeDefined();
    if (warning?.kind === 'unknown-path-field') {
      expect(warning.field).toBe('nope');
    }
  });

  it('splices constraints from a tagged callee factory in the same file', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        type FirestoreQueryConstraint = { __opaque: true };
        type JobApplication = { d: boolean; f: boolean; c: number; l: number; v: number; cat: number };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexCategory filter
         */
        export function jobApplicationsWithFullRangeQuery(fullRange = true): FirestoreQueryConstraint {
          return where<JobApplication>('f', '==', fullRange);
        }

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexScope COLLECTION
         * @dbxModelFirebaseIndexPath d, c, l, v, cat
         * @dbxModelFirebaseIndexPath d, f, c, l, v, cat
         */
        export function digestableQuery(fullRangeOnly: boolean): FirestoreQueryConstraint[] {
          return [
            where<JobApplication>('d', '==', true),
            jobApplicationsWithFullRangeQuery(fullRangeOnly),
            orderBy<JobApplication>('c', 'asc'),
            orderBy<JobApplication>('l', 'desc'),
            orderBy<JobApplication>('v', 'asc'),
            orderBy<JobApplication>('cat', 'asc')
          ];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'unannotated-query-helper')).toBeUndefined();
    const digestable = result.entries.find((e) => e.name === 'digestableQuery');
    expect(digestable).toBeDefined();
    if (digestable === undefined) return;
    expect(digestable.constraintSequences.map((s) => s.pathLabel)).toEqual(['d,c,l,v,cat', 'd,f,c,l,v,cat']);
    expect(digestable.constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['d', 'c', 'l', 'v', 'cat']);
    expect(digestable.constraintSequences[1].entries.map((e) => e.fieldPath)).toEqual(['d', 'f', 'c', 'l', 'v', 'cat']);
  });

  it('warns unannotated-query-helper for untagged constraint factories but still splices their constraints', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        type FirestoreQueryConstraint = { __opaque: true };
        type Job = { s: string; c: number };

        export function untaggedHelper(state: string): FirestoreQueryConstraint {
          return where<Job>('s', '==', state);
        }

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexScope COLLECTION
         * @dbxModelFirebaseIndexPath s, c
         */
        export function callerQuery(state: string): FirestoreQueryConstraint[] {
          return [untaggedHelper(state), orderBy<Job>('c', 'asc')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const warning = result.warnings.find((w) => w.kind === 'unannotated-query-helper');
    expect(warning).toBeDefined();
    if (warning?.kind === 'unannotated-query-helper') {
      expect(warning.callee).toBe('untaggedHelper');
      expect(warning.name).toBe('callerQuery');
    }
    const caller = result.entries.find((e) => e.name === 'callerQuery');
    expect(caller).toBeDefined();
    if (caller === undefined) return;
    // Even though the helper isn't tagged, its constraint is spliced.
    expect(caller.constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['s', 'c']);
  });

  it('does not warn for callees whose return type is not constraint-related', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        type FirestoreQueryConstraint = { __opaque: true };
        type Job = { s: string };

        export function utilityHelper(): Date {
          return new Date();
        }

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function callerQuery(): FirestoreQueryConstraint[] {
          const _x = utilityHelper();
          return [where<Job>('s', '==', 'a')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'unannotated-query-helper')).toBeUndefined();
    expect(result.warnings.find((w) => w.kind === 'transitive-cycle')).toBeUndefined();
    const caller = result.entries.find((e) => e.name === 'callerQuery');
    expect(caller).toBeDefined();
    if (caller === undefined) return;
    // utilityHelper contributes nothing — only the direct where call.
    expect(caller.constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['s']);
  });

  it('emits transitive-cycle when a callee recurses back into the caller', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): FirestoreQueryConstraint { return {} as FirestoreQueryConstraint; }
        type FirestoreQueryConstraint = { __opaque: true };
        type Job = { s: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function aQuery(): FirestoreQueryConstraint[] {
          return [where<Job>('s', '==', 'a'), bQuery()];
        }

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function bQuery(): FirestoreQueryConstraint[] {
          return [aQuery()];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const cycle = result.warnings.find((w) => w.kind === 'transitive-cycle');
    expect(cycle).toBeDefined();
    // Resolution finished without an infinite loop.
    expect(result.entries.length).toBe(2);
  });

  it('reports duplicate slugs only once', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/first.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexSlug shared-slug
         */
        export function firstQuery(): unknown[] {
          return [where<Job>('status', '==', 'a')];
        }
      `,
      '/proj/src/lib/model/job/second.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { status: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexSlug shared-slug
         */
        export function secondQuery(): unknown[] {
          return [where<Job>('status', '==', 'b')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.entries.length).toBe(1);
    expect(result.warnings.find((w) => w.kind === 'duplicate-slug')).toBeDefined();
  });
});

describe('extractModelFirebaseIndexEntries — body complexity rules', () => {
  it('emits no warning for a simple straight-line query body', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/job.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): unknown { return {}; }
        type Job = { t: string; dat: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobDigestsQuery(now: Date, type: string): unknown[] {
          return [where<Job>('t', 'in', type), orderBy<Job>('dat', 'asc')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'complex-query-body')).toBeUndefined();
    expect(result.entries[0].constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['t', 'dat']);
  });

  it('errors with complex-query-body when the body contains a switch statement', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/switch.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobSwitchQuery(mode: string): unknown[] {
          const out: unknown[] = [];
          switch (mode) {
            case 'a':
              out.push(where<Job>('s', '==', 'a'));
              break;
            default:
              out.push(where<Job>('s', '==', 'b'));
          }
          return out;
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'complex-query-body');
    expect(error).toBeDefined();
    if (error?.kind === 'complex-query-body') {
      expect(error.branchKind).toBe('switch');
      expect(error.severity).toBe('error');
    }
  });

  it('errors with complex-query-body when the body uses a ternary in an array spread', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/ternary.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobTernaryQuery(active: boolean): unknown[] {
          return [...(active ? [where<Job>('s', '==', 'a')] : [])];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'complex-query-body');
    expect(error).toBeDefined();
    if (error?.kind === 'complex-query-body') {
      expect(error.branchKind).toBe('ternary');
    }
  });

  it('errors with complex-query-body when the body iterates with for-of to push constraints', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/loop.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { s: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobLoopQuery(states: string[]): unknown[] {
          const out: unknown[] = [];
          for (const s of states) {
            out.push(where<Job>('s', '==', s));
          }
          return out;
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'complex-query-body');
    expect(error).toBeDefined();
    if (error?.kind === 'complex-query-body') {
      expect(error.branchKind).toBe('loop');
    }
  });

  it('allows nullish coalescing (??) for argument defaults without flagging the body', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/coalesce.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        function orderBy<T>(_a: keyof T, _d: 'asc' | 'desc'): unknown { return {}; }
        type Job = { t: string; dat: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobDigestsQuery(params: { now?: Date; type: string }): unknown[] {
          const { now, type } = params;
          const sinceDate = now ?? new Date();
          return [where<Job>('t', '==', type), where<Job>('dat', '<', sinceDate), orderBy<Job>('dat', 'asc')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'complex-query-body')).toBeUndefined();
    expect(result.entries[0].constraintSequences[0].entries.map((e) => e.fieldPath)).toEqual(['t', 'dat', 'dat']);
  });
});

describe('extractModelFirebaseIndexEntries — dispatcher tag', () => {
  it('skips body extraction and emits no constraints for a correctly tagged dispatcher', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dispatch.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { t: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         */
        export function jobsByStatusQuery(s: string): unknown[] {
          return [where<Job>('t', '==', s)];
        }

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexDispatcher
         */
        export function jobsDispatcher(mode: string, s: string): unknown[] {
          switch (mode) {
            case 'byStatus':
              return jobsByStatusQuery(s);
            default:
              return jobsByStatusQuery('default');
          }
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    expect(result.warnings.find((w) => w.kind === 'complex-query-body')).toBeUndefined();
    expect(result.warnings.find((w) => w.kind === 'non-delegating-dispatcher')).toBeUndefined();
    const dispatcher = result.entries.find((e) => e.name === 'jobsDispatcher');
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.constraintSequences).toEqual([]);
  });

  it('errors with non-delegating-dispatcher when a dispatcher calls where() directly', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dispatch.query.ts': `
        function where<T>(_a: keyof T, _op: string, _v: unknown): unknown { return {}; }
        type Job = { t: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexDispatcher
         */
        export function jobsBadDispatcher(s: string): unknown[] {
          return [where<Job>('t', '==', s)];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'non-delegating-dispatcher');
    expect(error).toBeDefined();
    if (error?.kind === 'non-delegating-dispatcher') {
      expect(error.callee).toBe('where');
      expect(error.severity).toBe('error');
    }
  });

  it('errors with non-delegating-dispatcher when a dispatcher calls a registered helper directly', () => {
    const project = projectWith({
      '/proj/src/lib/model/identity.ts': IDENTITY_FIXTURE,
      '/proj/src/lib/model/job/dispatch.query.ts': `
        function whereDateIsBeforeWithSort<T>(_a: keyof T, _d?: Date, _dir?: 'asc' | 'desc'): unknown[] { return []; }
        type Job = { dat: string };

        /**
         * @dbxModelFirebaseIndex
         * @dbxModelFirebaseIndexModel Job
         * @dbxModelFirebaseIndexDispatcher
         */
        export function jobsHelperDispatcher(): unknown[] {
          return [...whereDateIsBeforeWithSort<Job>('dat', new Date(), 'asc')];
        }
      `
    });
    const result = extractModelFirebaseIndexEntries({ project, identityResolver: buildIdentityResolverFromProject(project) });
    const error = result.warnings.find((w) => w.kind === 'non-delegating-dispatcher');
    expect(error).toBeDefined();
    if (error?.kind === 'non-delegating-dispatcher') {
      expect(error.callee).toBe('whereDateIsBeforeWithSort');
    }
  });
});
