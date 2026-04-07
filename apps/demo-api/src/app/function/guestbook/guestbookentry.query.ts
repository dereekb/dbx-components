import { publishedGuestbookEntry, type GuestbookEntry, type QueryGuestbookEntriesParams } from 'demo-firebase';
import { type OnCallQueryModelResult, orderBy, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { executeOnCallQuery, resolveAdminOnlyValue, withApiDetails, type OnCallQueryModelRequest } from '@dereekb/firebase-server';
import { type DemoQueryModelFunction, type DemoApiNestContext } from '../function.context';

export const queryGuestbookEntries: DemoQueryModelFunction<QueryGuestbookEntriesParams, OnCallQueryModelResult<GuestbookEntry>> = withApiDetails({
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
}) as any;
