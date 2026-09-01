/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run `npx nx run demo-cli:generate-firestore-query-manifest` to refresh.

import { profileWithUsernameQuery, publishedGuestbookEntriesQuery, publishedGuestbooksQuery } from 'demo-firebase';
import { type CliFirestoreQueryManifest, type CliGeneratedManifestStamp } from '@dereekb/dbx-cli';

export const DEMO_CLI_FIRESTORE_QUERY_MANIFEST_STAMP: CliGeneratedManifestStamp = { generatorVersion: '13.43.0' };

export const DEMO_CLI_FIRESTORE_QUERY_MANIFEST: CliFirestoreQueryManifest = [
  {
    slug: 'profile-with-username-query',
    name: 'profileWithUsernameQuery',
    module: 'demo-firebase',
    subpath: 'model/profile/profile.query',
    model: 'Profile',
    collection: 'pr',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'profileWithUsernameQuery(params: ProfileWithUsernameQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'ProfileWithUsernameQueryParams', description: '- The username to match.', optional: false }],
    description: 'Query for the profile holding a given unique username.',
    category: 'lookup',
    tags: ['lookup', 'profile', 'with', 'username', 'query', 'profilewithusernamequery', 'holding', 'given', 'unique'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: profileWithUsernameQuery
  },
  {
    slug: 'published-guestbook-entries-query',
    name: 'publishedGuestbookEntriesQuery',
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    model: 'GuestbookEntry',
    collection: 'gbe',
    isNested: true,
    scope: 'COLLECTION_GROUP',
    signature: 'publishedGuestbookEntriesQuery(params: PublishedGuestbookEntriesQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'PublishedGuestbookEntriesQueryParams', description: '- The published state to match.', optional: false }],
    description:
      "Query for the guestbook entries in the given published state.\n\nDeclared at `COLLECTION_GROUP` scope because it is used both within a single guestbook's `gbe`\nsubcollection and across the `gbe` collection group. Firestore auto-indexes single fields at\nCOLLECTION scope only, so the group-scoped use needs the explicit `fieldOverrides` entry this\nscope tag emits — without it the group query fails `FAILED_PRECONDITION` against a real project\n(the emulator does not enforce indexes, so it passes locally either way).",
    category: 'listing',
    tags: ['listing', 'guestbookentry', 'published', 'guestbook', 'entries', 'query', 'publishedguestbookentriesquery', 'entry', 'given', 'state', 'declared', 'collection', 'group', 'scope', 'because', 'used'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: true, parentPaths: ['gb/{guestbook}'] },
    factory: publishedGuestbookEntriesQuery
  },
  {
    slug: 'published-guestbooks-query',
    name: 'publishedGuestbooksQuery',
    module: 'demo-firebase',
    subpath: 'model/guestbook/guestbook.query',
    model: 'Guestbook',
    collection: 'gb',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'publishedGuestbooksQuery(params: PublishedGuestbooksQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'PublishedGuestbooksQueryParams', description: '- The published state to match.', optional: false }],
    description: 'Query for the guestbooks in the given published state.',
    category: 'listing',
    tags: ['listing', 'guestbook', 'published', 'guestbooks', 'query', 'publishedguestbooksquery', 'given', 'state'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: publishedGuestbooksQuery
  }
];
