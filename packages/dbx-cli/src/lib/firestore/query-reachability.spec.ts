import { describe, expect, it } from 'vitest';
import { type CliFirestoreQueryManifestEntry, type CliFirestoreQueryReachability } from '../manifest/types';
import { CliError } from '../util/output';
import { FIRESTORE_QUERY_PARENT_REQUIRED_CODE, FIRESTORE_QUERY_RULES_UNREACHABLE_CODE, assertCliFirestoreQueryIsReachable, cliFirestoreQueryReachability, cliFirestoreQueryReachabilityLabel, describeCliFirestoreQueryReachability, isCliFirestoreQueryInvocable } from './query-reachability';

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

describe('cliFirestoreQueryReachability()', () => {
  describe('COLLECTION_GROUP scope', () => {
    it('is reachable when a {path=**} block exists and list is allowed', () => {
      // the `jljt` shape: a nested collection that DOES carry a collection-group rule
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'allowed' })).toMatchObject({ verdict: 'reachable' });
    });

    it('degrades a NESTED collection with no {path=**} block to parent-only', () => {
      // the `jlja` shape: `allow list: admin` under `jl/{loc}/jlj/{job}`, but no group rule — the
      // exact case that returned AUTH_FORBIDDEN against production
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'allowed' })).toMatchObject({ verdict: 'parent-only', reason: 'no-collection-group-rule' });
    });

    it('calls a ROOT collection with no {path=**} block unreachable, because --parent cannot apply', () => {
      // `cliFirestoreCollectionForQuery` rejects --parent for a non-nested model, so there is no
      // path-scoped fallback to degrade to
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: false, collectionGroup: false, list: 'allowed' })).toMatchObject({ verdict: 'unreachable', reason: 'no-collection-group-rule' });
    });

    it('is unreachable when list is denied, even with a {path=**} block', () => {
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'denied' })).toMatchObject({ verdict: 'unreachable', reason: 'list-denied' });
    });

    it('distinguishes an unmatched list from a denied one', () => {
      // the `bgi` shape: no list grant written down at all
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'unmatched' })).toMatchObject({ verdict: 'unreachable', reason: 'list-unmatched' });
    });
  });

  describe('COLLECTION scope', () => {
    it('is reachable for a nested collection with an allowed list and no group rule', () => {
      // the path-scoped shape is exactly what a COLLECTION-scope entry runs, so the missing group
      // rule is irrelevant here
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION', isNested: true, collectionGroup: false, list: 'allowed' })).toMatchObject({ verdict: 'reachable' });
    });

    it('is reachable for a root collection with an allowed list', () => {
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION', isNested: false, collectionGroup: false, list: 'allowed' })).toMatchObject({ verdict: 'reachable' });
    });

    it('is unreachable when list is denied', () => {
      expect(cliFirestoreQueryReachability({ scope: 'COLLECTION', isNested: false, collectionGroup: false, list: 'denied' })).toMatchObject({ verdict: 'unreachable', reason: 'list-denied' });
    });
  });

  it('carries the rules facts and parent paths through', () => {
    expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: false, list: 'allowed', parentPaths: ['jl/{jobLocation}/jlj/{job}'] })).toEqual({
      verdict: 'parent-only',
      reason: 'no-collection-group-rule',
      list: 'allowed',
      collectionGroup: false,
      parentPaths: ['jl/{jobLocation}/jlj/{job}']
    } satisfies CliFirestoreQueryReachability);
  });

  it('omits parentPaths entirely when there are none', () => {
    expect(cliFirestoreQueryReachability({ scope: 'COLLECTION', isNested: false, collectionGroup: false, list: 'allowed', parentPaths: [] })).not.toHaveProperty('parentPaths');
  });

  it('never reports a reason on a reachable verdict', () => {
    expect(cliFirestoreQueryReachability({ scope: 'COLLECTION_GROUP', isNested: true, collectionGroup: true, list: 'allowed' })).not.toHaveProperty('reason');
  });
});

describe('assertCliFirestoreQueryIsReachable()', () => {
  it('passes an entry with no reachability at all', () => {
    // an unscanned manifest must behave exactly as it did before the field existed
    expect(() => assertCliFirestoreQueryIsReachable({ entry: buildEntry({}) })).not.toThrow();
  });

  it('passes a reachable entry', () => {
    expect(() => assertCliFirestoreQueryIsReachable({ entry: buildEntry({ reachability: { verdict: 'reachable', list: 'allowed', collectionGroup: true } }) })).not.toThrow();
  });

  it('refuses an unreachable entry, naming the missing rule', () => {
    const entry = buildEntry({ reachability: { verdict: 'unreachable', list: 'unmatched', collectionGroup: false, reason: 'list-unmatched' } });
    let caught: unknown;

    try {
      assertCliFirestoreQueryIsReachable({ entry });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe(FIRESTORE_QUERY_RULES_UNREACHABLE_CODE);
    expect((caught as CliError).message).toContain('jlja');
  });

  it('refuses an unreachable entry even when --parent is supplied', () => {
    const entry = buildEntry({ reachability: { verdict: 'unreachable', list: 'denied', collectionGroup: false, reason: 'list-denied' } });
    expect(() => assertCliFirestoreQueryIsReachable({ entry, parent: 'jl/abc/jlj/def' })).toThrow(CliError);
  });

  it('refuses a parent-only entry with no --parent, naming the parent path it needs', () => {
    const entry = buildEntry({ reachability: { verdict: 'parent-only', list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } });
    let caught: unknown;

    try {
      assertCliFirestoreQueryIsReachable({ entry });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe(FIRESTORE_QUERY_PARENT_REQUIRED_CODE);
    expect((caught as CliError).suggestion).toContain('jl/{jobLocation}/jlj/{job}');
  });

  it('allows a parent-only entry once --parent is supplied', () => {
    const entry = buildEntry({ reachability: { verdict: 'parent-only', list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } });
    expect(() => assertCliFirestoreQueryIsReachable({ entry, parent: 'jl/abc/jlj/def' })).not.toThrow();
  });
});

describe('cliFirestoreQueryReachabilityLabel()', () => {
  it('renders `?` when the manifest carries no verdict', () => {
    expect(cliFirestoreQueryReachabilityLabel(buildEntry({}))).toBe('?');
  });

  it('renders each verdict', () => {
    expect(cliFirestoreQueryReachabilityLabel(buildEntry({ reachability: { verdict: 'reachable', list: 'allowed', collectionGroup: true } }))).toBe('yes');
    expect(cliFirestoreQueryReachabilityLabel(buildEntry({ reachability: { verdict: 'parent-only', list: 'allowed', collectionGroup: false } }))).toBe('parent');
    expect(cliFirestoreQueryReachabilityLabel(buildEntry({ reachability: { verdict: 'unreachable', list: 'denied', collectionGroup: false } }))).toBe('no');
  });
});

describe('isCliFirestoreQueryInvocable()', () => {
  it('is false without a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ factory: undefined }))).toBe(false);
  });

  it('is true for an unscanned entry with a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({}))).toBe(true);
  });

  it('is true for a parent-only entry — --parent runs it', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ reachability: { verdict: 'parent-only', list: 'allowed', collectionGroup: false } }))).toBe(true);
  });

  it('is false for an unreachable entry even with a bound factory', () => {
    expect(isCliFirestoreQueryInvocable(buildEntry({ reachability: { verdict: 'unreachable', list: 'denied', collectionGroup: false } }))).toBe(false);
  });
});

describe('describeCliFirestoreQueryReachability()', () => {
  it('says the manifest was generated without a rules file when nothing is recorded', () => {
    expect(describeCliFirestoreQueryReachability(buildEntry({}))).toContain('--rules');
  });

  it('names the missing collection-group block for a parent-only entry', () => {
    const described = describeCliFirestoreQueryReachability(buildEntry({ reachability: { verdict: 'parent-only', list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] } }));

    expect(described).toContain('match /{path=**}/jlja/{id}');
    expect(described).toContain('--parent');
  });

  it('points an unreachable entry at server code', () => {
    expect(describeCliFirestoreQueryReachability(buildEntry({ reachability: { verdict: 'unreachable', list: 'denied', collectionGroup: false, reason: 'list-denied' } }))).toContain('server code');
  });
});
