import { type AllPublishedGuestbookEntriesParams, type AllPublishedGuestbookEntriesResult, allPublishedGuestbookEntriesParamsType, publishedGuestbookEntry, type GuestbookEntry } from 'demo-firebase';
import { type FirestoreQueryConstraint, type OnCallQueryModelResult } from '@dereekb/firebase';
import { executeOnCallQuery, withApiDetails } from '@dereekb/firebase-server';
import { type DemoInvokeModelFunction } from '../function.context';

/**
 * Server-side hard cap on the number of entries the {@link guestbookEntryAllPublishedEntries}
 * invoke will gather in one call, regardless of any caller-supplied limit.
 */
export const ALL_PUBLISHED_GUESTBOOK_ENTRIES_HARD_CAP = 500;

/**
 * Demo guestbookEntry invoke handler — paginates the collection group internally and
 * returns every published GuestbookEntry across all guestbooks in one response.
 *
 * Server-side equivalent of the CLI `queryAllPublishedGuestbookEntries` composition
 * in `apps/demo-cli/src/lib/actions/guestbook.actions.ts`. Use this when the caller
 * wants a single round trip instead of driving pagination themselves.
 */
export const guestbookEntryAllPublishedEntries: DemoInvokeModelFunction<AllPublishedGuestbookEntriesParams, AllPublishedGuestbookEntriesResult> = withApiDetails({
  inputType: allPublishedGuestbookEntriesParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const limit = Math.min(data.limit ?? ALL_PUBLISHED_GUESTBOOK_ENTRIES_HARD_CAP, ALL_PUBLISHED_GUESTBOOK_ENTRIES_HARD_CAP);
    const collection = nest.demoFirestoreCollections.guestbookEntryCollectionGroup;

    const buildConstraints = (): FirestoreQueryConstraint[] => [publishedGuestbookEntry(true)];

    const loadCursorDocument = async (key: string) => {
      const doc = await nest.useModel('guestbookEntry', {
        request,
        key,
        roles: 'read',
        use: (x) => x.document
      });

      return doc.accessor.get();
    };

    const entries: GuestbookEntry[] = [];
    let cursorDocumentKey: string | undefined = undefined;
    let hitLimit = false;

    while (entries.length < limit) {
      const remaining = limit - entries.length;
      const page: OnCallQueryModelResult<GuestbookEntry> = await executeOnCallQuery<GuestbookEntry>({
        params: { limit: remaining, cursorDocumentKey },
        collection,
        loadCursorDocument,
        buildConstraints
      });

      entries.push(...page.results);

      if (!page.hasMore || page.cursorDocumentKey == null) {
        break;
      }

      if (entries.length >= limit) {
        hitLimit = true;
        break;
      }

      cursorDocumentKey = page.cursorDocumentKey;
    }

    return {
      count: entries.length,
      entries,
      hitLimit
    };
  }
});
