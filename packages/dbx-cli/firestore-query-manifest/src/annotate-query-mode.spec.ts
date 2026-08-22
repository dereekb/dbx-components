import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { annotateQueryEntryMode } from './annotate-query-mode.js';
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
  return annotateQueryEntryMode({ entries, rulesSource: WORKSPACE_RULES });
}

describe('annotateQueryEntryMode()', () => {
  describe('against the workspace firestore.rules', () => {
    it('marks a collection-group query over `gbe` a model query — the rules declare /{path=**}/gbe/{id}', () => {
      const result = annotate([entry()]);

      expect(result.entries[0].queryMode).toBe('model');
      expect(result.entries[0].rules).toMatchObject({ list: 'allowed', collectionGroup: true });
      expect(result.model).toBe(1);
      expect(result.unavailableSlugs).toEqual([]);
      expect(result.parentChildSlugs).toEqual([]);
    });

    it('marks a collection-group query over a root collection with no group rule unavailable', () => {
      // `nbnw` sits under `nb/{notificationBox}` with no `{path=**}` block — the shape hellosubs'
      // `jlja` has, except the demo rules also deny its read outright, so `sf` is used instead below
      const result = annotate([entry({ slug: 'sf-group-query', collection: 'sf', model: 'StorageFile', isNested: false, scope: 'COLLECTION_GROUP' })]);

      // `sf` is a ROOT collection: --parent cannot apply, so there is no path-scoped fallback
      expect(result.entries[0].queryMode).toBe('unavailable');
      expect(result.entries[0].rules).toMatchObject({ reason: 'list-unmatched' });
      expect(result.unavailableSlugs).toEqual(['sf-group-query']);
    });

    it('marks a written-down `allow read: if false` collection unavailable as list-denied', () => {
      const result = annotate([entry({ slug: 'notifications-query', collection: 'nbn', model: 'Notification' })]);

      expect(result.entries[0].queryMode).toBe('unavailable');
      expect(result.entries[0].rules).toMatchObject({ reason: 'list-denied', list: 'denied' });
    });

    it('marks a collection the rules never name unavailable as list-unmatched', () => {
      const result = annotate([entry({ slug: 'system-state-query', collection: 'sys', model: 'SystemState', isNested: false, scope: 'COLLECTION' })]);

      expect(result.entries[0].queryMode).toBe('unavailable');
      expect(result.entries[0].rules).toMatchObject({ reason: 'list-unmatched', collectionGroup: false });
    });

    it('marks a path-scoped COLLECTION query over the nested `gbe` as parent-child', () => {
      // permitted by the rules, yet --parent is mandatory — the case a pure permission verdict
      // would have called plainly runnable
      const result = annotate([entry({ slug: 'entries-in-guestbook-query', scope: 'COLLECTION' })]);

      expect(result.entries[0].queryMode).toBe('parent-child');
      expect(result.entries[0].rules).toMatchObject({ reason: 'nested-collection-scope' });
    });

    it('derives the --parent path template from the nested match path', () => {
      const result = annotate([entry()]);

      // `/gb/{guestbook}/gbe/{guestbookEntry}` → `gb/{guestbook}`; the `/{path=**}/gbe/{id}` block
      // contributes nothing, because it names no concrete parent
      expect(result.entries[0].rules?.parentPaths).toEqual(['gb/{guestbook}']);
    });

    it('records no parent path for a root collection', () => {
      const result = annotate([entry({ slug: 'published-guestbooks-query', collection: 'gb', model: 'Guestbook', isNested: false, scope: 'COLLECTION' })]);

      expect(result.entries[0].rules).not.toHaveProperty('parentPaths');
    });

    it('annotates every entry, including the plain model ones', () => {
      // absence of the field has to keep meaning "generated without --rules", so a plain model
      // entry still carries an explicit mode
      const result = annotate([entry(), entry({ slug: 'a', collection: 'nbn' })]);

      expect(result.entries.every((x) => x.queryMode != null && x.rules != null)).toBe(true);
    });

    it('preserves entry order and every other field', () => {
      const input = [entry({ slug: 'first' }), entry({ slug: 'second', collection: 'nbn' }), entry({ slug: 'third' })];
      const result = annotate(input);

      expect(result.entries.map((x) => x.slug)).toEqual(['first', 'second', 'third']);
      expect(result.entries[0]).toMatchObject({ name: input[0].name, module: input[0].module, subpath: input[0].subpath });
    });
  });

  it('degrades a NESTED collection-group query with no group rule to parent-child', () => {
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

    const result = annotateQueryEntryMode({ entries: [entry({ slug: 'job-applications-not-closed-query', collection: 'jlja', model: 'JobApplication' })], rulesSource });

    expect(result.entries[0].queryMode).toBe('parent-child');
    expect(result.entries[0].rules).toEqual({
      reason: 'no-collection-group-rule',
      list: 'allowed',
      collectionGroup: false,
      parentPaths: ['jl/{jobLocation}/jlj/{job}']
    });
    expect(result.parentChildSlugs).toEqual(['job-applications-not-closed-query']);
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

    const result = annotateQueryEntryMode({ entries: [entry({ slug: 'x-query', collection: 'x', model: 'X' })], rulesSource });

    expect(result.entries[0].rules?.parentPaths).toEqual(['a/{aId}', 'b/{bId}']);
  });
});
