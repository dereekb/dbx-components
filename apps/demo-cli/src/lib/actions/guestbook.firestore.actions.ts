import { type ActionCommandSpec, type CliContext } from '@dereekb/dbx-cli';
import { type FirebaseAuthUserId, limit } from '@dereekb/firebase';
import { type Guestbook, type GuestbookEntry, type GuestbookKey, guestbookIdentity, publishedGuestbookEntriesQuery, publishedGuestbooksQuery } from 'demo-firebase';
import { demoCliFirestore } from '../firestore';

// MARK: queryPublishedGuestbookEntriesDirect
/**
 * Input for {@link queryPublishedGuestbookEntriesDirect}.
 */
export interface QueryPublishedGuestbookEntriesDirectInput {
  readonly context: CliContext;
  /**
   * Max guestbooks to visit. Unbounded when omitted.
   */
  readonly limit?: number;
}

/**
 * Per-guestbook breakdown returned by {@link queryPublishedGuestbookEntriesDirect}.
 */
export interface PublishedGuestbookEntriesDirectResult {
  readonly guestbook: GuestbookKey;
  readonly name: string;
  readonly count: number;
  readonly entries: ReadonlyArray<GuestbookEntry>;
}

/**
 * Output for {@link queryPublishedGuestbookEntriesDirect}.
 */
export interface QueryPublishedGuestbookEntriesDirectOutput {
  /**
   * The uid the session was minted for — the CLI reads as exactly this user.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * Whether the session carried an App Check attestation. False against the emulators, which do not
   * verify attestations, and against an API with no `appCheckAppId` configured.
   */
  readonly appCheckAttested: boolean;
  readonly guestbookCount: number;
  readonly entryCount: number;
  readonly perGuestbook: ReadonlyArray<PublishedGuestbookEntriesDirectResult>;
}

/**
 * Gathers every published Guestbook and its published entries over a **direct** Firestore connection.
 *
 * The direct-Firestore counterpart of {@link queryAllPublishedGuestbookEntries}, which does the same
 * aggregation over the model HTTP API — one round-trip per page, per guestbook. This version opens one
 * session (`GET /api/session/firestore`) and then reads Firestore itself, through the same security
 * rules the browser app is subject to, using the same `makeDemoFirestoreCollections` object the
 * Angular app builds — reached through {@link demoCliFirestore}, so the collections arrive at their
 * real `DemoFirestoreCollections` type and are not rebuilt here.
 *
 * Requires the env to carry a Firebase client config and the logged-in user to be an admin holding the
 * `session.firestore` scope. There is deliberately no fallback to the model API — a failure throws.
 *
 * @param input - The function inputs.
 * @returns Aggregate counts plus the per-Guestbook breakdown, and the session's uid.
 *
 * @example
 * ```ts
 * const summary = await queryPublishedGuestbookEntriesDirect({ context, limit: 10 });
 * ```
 */
export async function queryPublishedGuestbookEntriesDirect(input: QueryPublishedGuestbookEntriesDirectInput): Promise<QueryPublishedGuestbookEntriesDirectOutput> {
  // one call for both: `collections` is typed `DemoFirestoreCollections`, and `session` is the very
  // session the CLI already opened — no second collections build, no second session
  const { collections, session } = await demoCliFirestore(input.context);

  // `publishedGuestbooksQuery` is also what the Angular app's guestbook list and the demo-api query
  // handler use — the constraint, the collections object, and the rules are all shared; only the
  // transport differs.
  const guestbookConstraints = [...publishedGuestbooksQuery({ published: true }), ...(input.limit == null ? [] : [limit(input.limit)])];

  // `getDocSnapshotDataPairs()` + the per-ref converter costs ONE read per row. `getDocs()` would cost
  // two: `queryLike` is converter-less, so it re-loads every matched document from its ref just to
  // apply the converter.
  const guestbookPairs = await collections.guestbookCollection.queryDocument(...guestbookConstraints).getDocSnapshotDataPairs();

  const perGuestbook: PublishedGuestbookEntriesDirectResult[] = [];

  for (const { document: guestbookDocument, snapshot: guestbookSnapshot } of guestbookPairs) {
    const guestbook = guestbookDocument.converter.fromFirestore(guestbookSnapshot as never) as Guestbook;
    const entryPairs = await collections
      .guestbookEntryCollectionFactory(guestbookDocument)
      .queryDocument(...publishedGuestbookEntriesQuery({ published: true }))
      .getDocSnapshotDataPairs();
    const entries = entryPairs.map((pair) => pair.document.converter.fromFirestore(pair.snapshot as never) as GuestbookEntry);

    perGuestbook.push({
      guestbook: guestbookDocument.key,
      name: guestbook?.name ?? '',
      count: entries.length,
      entries
    });
  }

  return {
    uid: session.session.uid,
    appCheckAttested: Boolean(session.session.appCheckToken),
    guestbookCount: perGuestbook.length,
    entryCount: perGuestbook.reduce((acc, x) => acc + x.count, 0),
    perGuestbook
  };
}

/**
 * Action: aggregate every published Guestbook's published entries over a direct Firestore connection.
 */
export const QUERY_PUBLISHED_GUESTBOOK_ENTRIES_DIRECT_ACTION: ActionCommandSpec = {
  command: 'direct-published-entries',
  describe: 'Aggregate published Guestbook entries over a DIRECT Firestore connection (admin-only; requires the session.firestore scope).',
  model: guestbookIdentity.modelType,
  builder: (y) => y.option('limit', { type: 'number', describe: 'Max guestbooks to visit.' }),
  handler: ({ context, argv }) =>
    queryPublishedGuestbookEntriesDirect({
      context,
      limit: (argv as { readonly limit?: number }).limit
    })
};
