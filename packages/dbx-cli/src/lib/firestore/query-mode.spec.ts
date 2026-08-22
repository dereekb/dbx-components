import { describe, expect, it } from 'vitest';
import { type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { CliError } from '../util/output';
import { FIRESTORE_QUERY_PARENT_REQUIRED_CODE, FIRESTORE_QUERY_UNAVAILABLE_CODE, assertCliFirestoreQueryCanRun, cliFirestoreQueryMode, cliFirestoreQueryModeForRules, describeCliFirestoreQueryMode, isCliFirestoreQueryInvocable } from './query-mode';

function buildEntry(input: Partial<CliFirestoreQueryManifestEntry>): CliFirestoreQueryManifestEntry {
  return {
    slug: 'job-applications-not-closed-query',
    name: 'jobApplicationsNotClosedQuery',
    module: 'hellosubs-firebase',
    subpath: 'src/lib/model/job/job.application.query.ts',
    model: 'JobApplication',
    collection: 'jlja',
    isNested: true,
    scope: 'COLLECTION_GROUP',
    signature: 'jobApplicationsNotClosedQuery(): FirestoreQueryConstraint[]',
    params: [],
    factory: () => [],
    ...input
  } as CliFirestoreQueryManifestEntry;
}

describe('cliFirestoreQueryModeForRules()', () => {
  describe('COLLECTION_GROUP scope', () => {
    it('is a model query when a {path=**} block exists and list is allowed', () => {
      // the `jljt` shape: a nested collection that DOES carry a collection-group rule
      expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'allowed' }).mode).toBe('model');
    });

    it('degrades a NESTED collection with no {path=**} block to parent-child', () => {
      // the `jlja` shape: `allow list: admin` under `jl/{loc}/jlj/{job}`, but no group rule — the
      // exact case that returned AUTH_FORBIDDEN against production
      const result = cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'allowed' });

      expect(result.mode).toBe('parent-child');
      expect(result.rules.reason).toBe('no-collection-group-rule');
    });

    it('calls a ROOT collection with no {path=**} block unavailable, because --parent cannot apply', () => {
      // `cliFirestoreCollectionForQuery` rejects --parent for a non-nested model, so there is no
      // path-scoped fallback to degrade to
      const result = cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: false, collectionGroup: false, list: 'allowed' });

      expect(result.mode).toBe('unavailable');
      expect(result.rules.reason).toBe('no-collection-group-rule');
    });

    it('is unavailable when list is denied, even with a {path=**} block', () => {
      const result = cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'denied' });

      expect(result.mode).toBe('unavailable');
      expect(result.rules.reason).toBe('list-denied');
    });

    it('distinguishes an unmatched list from a denied one', () => {
      // the `bgi` shape: no list grant written down at all
      expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'unmatched' }).rules.reason).toBe('list-unmatched');
    });
  });

  describe('COLLECTION scope', () => {
    it('is a PARENT-CHILD query for a nested collection, even though the rules permit the read', () => {
      // the axis that a pure permission verdict gets wrong: `cliFirestoreCollectionForQuery` makes
      // --parent mandatory here, so calling this a plain model query would misdescribe how to run it
      const result = cliFirestoreQueryModeForRules({ scope: 'COLLECTION', isNested: true, collectionGroup: false, list: 'allowed' });

      expect(result.mode).toBe('parent-child');
      expect(result.rules.reason).toBe('nested-collection-scope');
    });

    it('is a model query for a root collection with an allowed list', () => {
      expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION', isNested: false, collectionGroup: false, list: 'allowed' }).mode).toBe('model');
    });

    it('is unavailable when list is denied, ahead of the nesting check', () => {
      const result = cliFirestoreQueryModeForRules({ scope: 'COLLECTION', isNested: true, collectionGroup: false, list: 'denied' });

      expect(result.mode).toBe('unavailable');
      expect(result.rules.reason).toBe('list-denied');
    });
  });

  it('carries the rules facts and parent paths through', () => {
    expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'allowed', parentPaths: ['jl/{jobLocation}/jlj/{job}'] })).toEqual({
      mode: 'parent-child',
      rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] }
    });
  });

  it('omits parentPaths entirely when there are none', () => {
    expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION', isNested: false, collectionGroup: false, list: 'allowed', parentPaths: [] }).rules).not.toHaveProperty('parentPaths');
  });

  it('never reports a reason on a model mode', () => {
    expect(cliFirestoreQueryModeForRules({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'allowed' }).rules).not.toHaveProperty('reason');
  });
});

describe('cliFirestoreQueryMode()', () => {
  it('normalizes an absent field to `unknown`', () => {
    expect(cliFirestoreQueryMode(buildEntry({}))).toBe('unknown');
  });

  it('returns the stored mode', () => {
    expect(cliFirestoreQueryMode(buildEntry({ queryMode: 'parent-child' }))).toBe('parent-child');
  });
});

describe('assertCliFirestoreQueryCanRun()', () => {
  it('passes an entry with no mode at all', () => {
    // an unscanned manifest must behave exactly as it did before the field existed
    expect(() => assertCliFirestoreQueryCanRun({ entry: buildEntry({}) })).not.toThrow();
  });

  it('passes a model entry', () => {
    expect(() => assertCliFirestoreQueryCanRun({ entry: buildEntry({ queryMode: 'model' }) })).not.toThrow();
  });

  it('refuses an unavailable entry, naming the collection', () => {
    const entry = buildEntry({ queryMode: 'unavailable', rules: { list: 'unmatched', collectionGroup: false, reason: 'list-unmatched' } });
    let caught: unknown;

    try {
      assertCliFirestoreQueryCanRun({ entry });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe(FIRESTORE_QUERY_UNAVAILABLE_CODE);
    expect((caught as CliError).message).toContain('jlja');
  });

  it('refuses an unavailable entry even when --parent is supplied', () => {
    const entry = buildEntry({ queryMode: 'unavailable', rules: { list: 'denied', collectionGroup: false, reason: 'list-denied' } });
    expect(() => assertCliFirestoreQueryCanRun({ entry, parent: 'jl/abc/jlj/def' })).toThrow(CliError);
  });

  it('refuses a parent-child entry with no --parent, naming the parent path it needs', () => {
    const entry = buildEntry({ queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } });
    let caught: unknown;

    try {
      assertCliFirestoreQueryCanRun({ entry });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe(FIRESTORE_QUERY_PARENT_REQUIRED_CODE);
    expect((caught as CliError).suggestion).toContain('jl/{jobLocation}/jlj/{job}');
  });

  it('refuses a COLLECTION-scope nested entry with no --parent too', () => {
    const entry = buildEntry({ scope: 'COLLECTION', queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'nested-collection-scope', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } });
    expect(() => assertCliFirestoreQueryCanRun({ entry })).toThrow(CliError);
  });

  it('allows a parent-child entry once --parent is supplied', () => {
    const entry = buildEntry({ queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } });
    expect(() => assertCliFirestoreQueryCanRun({ entry, parent: 'jl/abc/jlj/def' })).not.toThrow();
  });
});

describe('isCliFirestoreQueryInvocable()', () => {
  it('is false without a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ factory: undefined }))).toBe(false);
  });

  it('is true for an unscanned entry with a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({}))).toBe(true);
  });

  it('is true for a parent-child entry — --parent runs it', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ queryMode: 'parent-child' }))).toBe(true);
  });

  it('is false for an unavailable entry even with a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ queryMode: 'unavailable' }))).toBe(false);
  });
});

describe('describeCliFirestoreQueryMode()', () => {
  it('says the manifest was generated without a rules file when nothing is recorded', () => {
    expect(describeCliFirestoreQueryMode(buildEntry({}))).toContain('--rules');
  });

  it('names the missing collection-group rule and the --parent shape for a parent-child entry', () => {
    const described = describeCliFirestoreQueryMode(buildEntry({ queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } }));

    expect(described).toContain('match /{path=**}/jlja/{id}');
    expect(described).toContain('--parent');
  });

  it('explains a nested COLLECTION-scope entry without invoking the group rule', () => {
    const described = describeCliFirestoreQueryMode(buildEntry({ scope: 'COLLECTION', queryMode: 'parent-child', rules: { list: 'allowed', collectionGroup: false, reason: 'nested-collection-scope', parentPaths: ['gb/{guestbook}'] } }));

    expect(described).toContain('COLLECTION scope');
    expect(described).not.toContain('{path=**}');
    // the group-scope index caveat does not apply to an entry that is already COLLECTION-scope
    expect(described).not.toContain('composite index');
  });

  it('points an unavailable entry at server code', () => {
    expect(describeCliFirestoreQueryMode(buildEntry({ queryMode: 'unavailable', rules: { list: 'denied', collectionGroup: false, reason: 'list-denied' } }))).toContain('server code');
  });
});
