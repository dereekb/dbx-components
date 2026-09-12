/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run `npx nx run demo-cli:generate-firestore-query-manifest` to refresh.

import { openRouterPromptsWithStateQuery, openRouterRunTasksExpiredQuery, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from '@dereekb/openrouter/firebase';
import { profileWithUsernameQuery, publishedGuestbookEntriesQuery, publishedGuestbooksQuery } from 'demo-firebase';
import { type CliFirestoreQueryManifest, type CliGeneratedManifestStamp } from '@dereekb/dbx-cli';

export const DEMO_CLI_FIRESTORE_QUERY_MANIFEST_STAMP: CliGeneratedManifestStamp = { generatorVersion: '14.2.0' };

export const DEMO_CLI_FIRESTORE_QUERY_MANIFEST: CliFirestoreQueryManifest = [
  {
    slug: 'open-router-prompts-with-state-query',
    name: 'openRouterPromptsWithStateQuery',
    module: '@dereekb/openrouter/firebase',
    subpath: 'openrouter.query',
    model: 'OpenRouterPrompt',
    collection: 'orp',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'openRouterPromptsWithStateQuery(params: OpenRouterPromptsWithStateQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'OpenRouterPromptsWithStateQueryParams', description: '- The state to match.', optional: false }],
    description:
      "Query for the prompts in one lifecycle state.\n\nNeeds no composite index, and is deliberately kept that way. Unordered, so pagination falls through to\nFirestore's implicit `__name__` order — which for this model is the prompt's own readable key, already\nthe order a listing wants — and state is the only filter axis: pairing it with an `array-contains` on\n`t` would buy a composite index for a collection measured in dozens of documents.",
    category: 'admin',
    tags: ['admin', 'openrouterprompt', 'open', 'router', 'prompts', 'with', 'state', 'query', 'openrouterpromptswithstatequery', 'prompt', 'one', 'lifecycle', 'needs', 'composite', 'index', 'deliberately', 'kept', 'way'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: openRouterPromptsWithStateQuery
  },
  {
    slug: 'open-router-run-tasks-expired-query',
    name: 'openRouterRunTasksExpiredQuery',
    module: '@dereekb/openrouter/firebase',
    subpath: 'openrouter.query',
    model: 'OpenRouterRunTask',
    collection: 'orrt',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'openRouterRunTasksExpiredQuery(params: OpenRouterRunTasksExpiredQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'OpenRouterRunTasksExpiredQueryParams', description: '- The retention cutoff and page limit.', optional: false }],
    description:
      "Query for run tasks past their retention age, for deletion. Matches EVERY state, `RUNNING` included —\nsee {@link OPENROUTER_RUN_TASK_MAX_AGE} for why the ceiling is the whole requirement.\n\nOrdered by `qat` with no state filter, so it needs no composite index at all: a single-field range with\na matching order is served by Firestore's automatic single-field index.\n\nFirestore's NATIVE TTL policy cannot do this job, for the same reason the cutoff goes through\n`whereDateIsOnOrBefore` rather than a bare `where('qat', '<=', date)`: `firestoreDate` persists an\nISO8601 STRING, and a TTL policy only deletes on a `Timestamp` field. Pointed at `qat` it would\nsilently never fire. The app-level sweep is the mechanism here, not a stopgap for one.",
    category: 'cleanup',
    tags: ['cleanup', 'openrouterruntask', 'open', 'router', 'run', 'tasks', 'expired', 'query', 'openrouterruntasksexpiredquery', 'task', 'past', 'their', 'retention', 'age', 'deletion', 'matches', 'every', 'state'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: openRouterRunTasksExpiredQuery
  },
  {
    slug: 'open-router-run-tasks-reclaimable-query',
    name: 'openRouterRunTasksReclaimableQuery',
    module: '@dereekb/openrouter/firebase',
    subpath: 'openrouter.query',
    model: 'OpenRouterRunTask',
    collection: 'orrt',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'openRouterRunTasksReclaimableQuery(params: OpenRouterRunTasksReclaimableQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'OpenRouterRunTasksReclaimableQueryParams', description: '- The page limit and lease cutoff.', optional: false }],
    description:
      "Query for RUNNING run tasks whose lease has gone stale — crash recovery.\n\nSeparate from {@link openRouterRunTasksRunnableQuery} because it needs a range filter on `lat`, and\nFirestore allows the range filter on only one field, which the ordering must then lead with.\n\nThe cutoff goes through `whereDateIsOnOrBefore` rather than a bare `where('lat', '<=', date)`:\n`firestoreDate` persists an ISO8601 STRING, so comparing the field against a `Date` compares a string\nto a timestamp and matches nothing — silently, with no error and an empty page, which reads exactly\nlike \"no crashed sweeps to recover\".",
    category: 'sweep',
    tags: ['sweep', 'openrouterruntask', 'open', 'router', 'run', 'tasks', 'reclaimable', 'query', 'openrouterruntasksreclaimablequery', 'task', 'running', 'whose', 'lease', 'has', 'gone', 'stale', 'crash', 'recovery'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: openRouterRunTasksReclaimableQuery
  },
  {
    slug: 'open-router-run-tasks-runnable-query',
    name: 'openRouterRunTasksRunnableQuery',
    module: '@dereekb/openrouter/firebase',
    subpath: 'openrouter.query',
    model: 'OpenRouterRunTask',
    collection: 'orrt',
    isNested: false,
    scope: 'COLLECTION',
    signature: 'openRouterRunTasksRunnableQuery(params: OpenRouterRunTasksRunnableQueryParams): FirestoreQueryConstraint[]',
    params: [{ name: 'params', type: 'OpenRouterRunTasksRunnableQueryParams', description: '- The page limit.', optional: false }],
    description:
      "Query for the run tasks a sweep may execute, oldest-queued first.\n\nQueue order is the ONLY order, and deliberately so. A priority column costs a second composite index\nand buys a second failure mode: Firestore sorts `null` before every number, so one task written without\na priority jumps the entire queue. Delaying a run is `NotificationTask`'s job — it owns the delayed\nfiring — which leaves nothing for a priority here to express.",
    category: 'sweep',
    tags: ['sweep', 'openrouterruntask', 'open', 'router', 'run', 'tasks', 'runnable', 'query', 'openrouterruntasksrunnablequery', 'task', 'may', 'execute', 'oldest', 'queued', 'first', 'queue', 'order', 'only'],
    queryMode: 'model',
    rules: { list: 'allowed', collectionGroup: false },
    factory: openRouterRunTasksRunnableQuery
  },
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
