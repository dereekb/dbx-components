import { publishedGuestbookEntry, type GuestbookEntry, type QueryAllGuestbookEntriesParams, type QueryGuestbookEntriesParams } from 'demo-firebase';
import { type OnCallQueryModelResult, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { executeOnCallQuery, resolveAdminOnlyValue, withApiDetails, type OnCallQueryModelRequest } from '@dereekb/firebase-server';
import { type DemoQueryModelFunction, type DemoApiNestContext } from '../function.context';

export const guestbookEntryQuery: DemoQueryModelFunction<QueryGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>> = withApiDetails({
  mcp: { description: 'Query guestbook entries for a specific guestbook with optional filtering by published status' },
  fn: async (request: OnCallQueryModelRequest<DemoApiNestContext, QueryGuestbookEntriesParams>) => {
    const { nest, data } = request;

    const published = resolveAdminOnlyValue({
      request,
      value: data.published,
      defaultValue: true,
      isAdminOnlyValue: (v) => v !== true,
      messageOrError: { message: 'Users can only search published guestbook entries.' }
    });

    // Assert that the user can read the parent guestbook
    const guestbookDoc = await nest.useModel('guestbook', {
      request,
      key: data.guestbook,
      roles: 'read',
      use: (x) => x.document
    });

    const entryCollection = nest.demoFirestoreCollections.guestbookEntryCollectionFactory(guestbookDoc);

    return executeOnCallQuery<GuestbookEntry>({
      params: data,
      collection: entryCollection,
      loadCursorDocument: async (key) => {
        const doc = await nest.useModel('guestbookEntry', {
          request,
          key,
          roles: 'read',
          use: (x) => x.document
        });

        return doc.accessor.get();
      },
      buildConstraints: () => {
        const constraints: FirestoreQueryConstraint[] = [];

        if (published != null) {
          constraints.push(publishedGuestbookEntry(published));
        }

        return constraints;
      }
    });
  }
});

/**
 * Cross-guestbook query handler — wired to `guestbookEntry.query.entries`.
 *
 * Queries the GuestbookEntry collection group, so no parent guestbook is required.
 * Non-admin callers are constrained to `published: true` via {@link resolveAdminOnlyValue}.
 */
export const guestbookEntryEntriesQuery: DemoQueryModelFunction<QueryAllGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>> = withApiDetails({
  mcp: { description: 'Query GuestbookEntry across all guestbooks (collection group) with optional filtering by published status. Non-admin callers are restricted to published entries.' },
  fn: async (request: OnCallQueryModelRequest<DemoApiNestContext, QueryAllGuestbookEntriesParams>) => {
    const { nest, data } = request;

    const published = resolveAdminOnlyValue({
      request,
      value: data.published,
      defaultValue: true,
      isAdminOnlyValue: (v) => v !== true,
      messageOrError: { message: 'Users can only search published guestbook entries.' }
    });

    return executeOnCallQuery<GuestbookEntry>({
      params: data,
      collection: nest.demoFirestoreCollections.guestbookEntryCollectionGroup,
      loadCursorDocument: async (key) => {
        const doc = await nest.useModel('guestbookEntry', {
          request,
          key,
          roles: 'read',
          use: (x) => x.document
        });

        return doc.accessor.get();
      },
      buildConstraints: () => {
        const constraints: FirestoreQueryConstraint[] = [];

        if (published != null) {
          constraints.push(publishedGuestbookEntry(published));
        }

        return constraints;
      }
    });
  }
});
