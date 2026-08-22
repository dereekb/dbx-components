import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { annotateQueryEntryReachability } from './annotate-reachability.js';
import type { CollectedQueryEntry } from './types.js';

const WORKSPACE_RULES = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');

function entry(overrides: Partial<CollectedQueryEntry> = {}): CollectedQueryEntry {
  return {
    slug: 'published-guestbook-entries-query',
    name: 'publishedGuestbookEntriesQuery',
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    model: 'GuestbookEntry',
    collection: 'gbe',
    isNested: true,
    scope: 'COLLECTION_GROUP',
    signature: 'publishedGuestbookEntriesQuery(): FirestoreQueryConstraint[]',
    params: [],
    ...overrides
  };
}

function annotate(entries: readonly CollectedQueryEntry[]) {
  return annotateQueryEntryReachability({ entries, rulesSource: WORKSPACE_RULES });
}

describe('annotateQueryEntryReachability()', () => {
  describe('against the workspace firestore.rules', () => {
    it('marks a collection-group query over `gbe` reachable — the rules declare /{path=**}/gbe/{id}', () => {
      const result = annotate([entry()]);

      expect(result.entries[0].reachability).toMatchObject({ verdict: 'reachable', list: 'allowed', collectionGroup: true });
      expect(result.reachable).toBe(1);
      expect(result.unreachableSlugs).toEqual([]);
      expect(result.parentOnlySlugs).toEqual([]);
    });

    it('marks a collection-group query over a nested collection with no group rule parent-only', () => {
      // `nbnw` sits under `nb/{notificationBox}` with no `{path=**}` block — the shape hellosubs'
      // `jlja` has, except the demo rules also deny its read outright, so `sf` is used instead below
      const result = annotate([entry({ slug: 'sf-group-query', collection: 'sf', model: 'StorageFile', isNested: false, scope: 'COLLECTION_GROUP' })]);

      // `sf` is a ROOT collection: --parent cannot apply, so there is no path-scoped fallback
      expect(result.entries[0].reachability).toMatchObject({ verdict: 'unreachable', reason: 'list-unmatched' });
      expect(result.unreachableSlugs).toEqual(['sf-group-query']);
    });

    it('marks a written-down `allow read: if false` collection unreachable as list-denied', () => {
      const result = annotate([entry({ slug: 'notifications-query', collection: 'nbn', model: 'Notification' })]);

      expect(result.entries[0].reachability).toMatchObject({ verdict: 'unreachable', reason: 'list-denied', list: 'denied' });
    });

    it('marks a collection the rules never name unreachable as list-unmatched', () => {
      const result = annotate([entry({ slug: 'system-state-query', collection: 'sys', model: 'SystemState', isNested: false, scope: 'COLLECTION' })]);

      expect(result.entries[0].reachability).toMatchObject({ verdict: 'unreachable', reason: 'list-unmatched', collectionGroup: false });
    });

    it('marks a path-scoped COLLECTION query over `gbe` reachable', () => {
      const result = annotate([entry({ slug: 'entries-in-guestbook-query', scope: 'COLLECTION' })]);

      expect(result.entries[0].reachability).toMatchObject({ verdict: 'reachable' });
    });

    it('derives the --parent path template from the nested match path', () => {
      const result = annotate([entry()]);

      // `/gb/{guestbook}/gbe/{guestbookEntry}` → `gb/{guestbook}`; the `/{path=**}/gbe/{id}` block
      // contributes nothing, because it names no concrete parent
      expect(result.entries[0].reachability?.parentPaths).toEqual(['gb/{guestbook}']);
    });

    it('records no parent path for a root collection', () => {
      const result = annotate([entry({ slug: 'published-guestbooks-query', collection: 'gb', model: 'Guestbook', isNested: false, scope: 'COLLECTION' })]);

      expect(result.entries[0].reachability).not.toHaveProperty('parentPaths');
    });

    it('annotates every entry, including the reachable ones', () => {
      // absence of the field has to keep meaning "generated without --rules", so a reachable entry
      // still carries an explicit verdict
      const result = annotate([entry(), entry({ slug: 'a', collection: 'nbn' })]);

      expect(result.entries.every((x) => x.reachability != null)).toBe(true);
    });

    it('preserves entry order and every other field', () => {
      const input = [entry({ slug: 'first' }), entry({ slug: 'second', collection: 'nbn' }), entry({ slug: 'third' })];
      const result = annotate(input);

      expect(result.entries.map((x) => x.slug)).toEqual(['first', 'second', 'third']);
      expect(result.entries[0]).toMatchObject({ name: input[0].name, module: input[0].module, subpath: input[0].subpath });
    });
  });

  it('degrades a NESTED collection-group query with no group rule to parent-only', () => {
    const rulesSource = `
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /jl/{jobLocation}/jlj/{job}/jlja/{jobApplication} {
            allow get: if true;
            allow list: if isAdmin();
          }
        }
      }
    `;

    const result = annotateQueryEntryReachability({ entries: [entry({ slug: 'job-applications-not-closed-query', collection: 'jlja', model: 'JobApplication' })], rulesSource });

    expect(result.entries[0].reachability).toEqual({
      verdict: 'parent-only',
      reason: 'no-collection-group-rule',
      list: 'allowed',
      collectionGroup: false,
      parentPaths: ['jl/{jobLocation}/jlj/{job}']
    });
    expect(result.parentOnlySlugs).toEqual(['job-applications-not-closed-query']);
  });

  it('collects every distinct nested parent path when a collection is mounted twice', () => {
    const rulesSource = `
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /a/{aId}/x/{xId} { allow list: if true; }
          match /b/{bId}/x/{xId} { allow list: if true; }
        }
      }
    `;

    const result = annotateQueryEntryReachability({ entries: [entry({ slug: 'x-query', collection: 'x', model: 'X' })], rulesSource });

    expect(result.entries[0].reachability?.parentPaths).toEqual(['a/{aId}', 'b/{bId}']);
  });
});
