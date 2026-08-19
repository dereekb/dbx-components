import { type ActionCommandSpec, type CliContext, requireCliFirestoreSession } from '@dereekb/dbx-cli';
import { type FirebaseAuthUserId, limit } from '@dereekb/firebase';
import { type GuestbookEntry, type GuestbookKey, guestbookIdentity, makeDemoFirestoreCollections, publishedGuestbook, publishedGuestbookEntry } from 'demo-firebase';

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
 * Angular app builds.
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
  const session = await requireCliFirestoreSession(input.context);
  const collections = makeDemoFirestoreCollections(session.firestoreContext);

  // `publishedGuestbook()` is also what the Angular app's guestbook queries use — the constraint, the
  // collections object, and the rules are all shared; only the transport differs.
  const guestbookConstraints = [publishedGuestbook(), ...(input.limit == null ? [] : [limit(input.limit)])];
  const guestbookDocs = await collections.guestbookCollection.queryDocument(...guestbookConstraints).getDocs();

  const perGuestbook: PublishedGuestbookEntriesDirectResult[] = [];

  for (const guestbookDocument of guestbookDocs) {
    const guestbook = await guestbookDocument.snapshotData();
    const entryDocs = await collections.guestbookEntryCollectionFactory(guestbookDocument).queryDocument(publishedGuestbookEntry()).getDocs();
    const entries = (await Promise.all(entryDocs.map((x) => x.snapshotData()))).filter((x): x is GuestbookEntry => x != null);

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
