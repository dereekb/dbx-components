import { type Guestbook, type QueryGuestbooksParams, publishedGuestbook } from 'demo-firebase';
import { type OnCallQueryModelResult, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { executeOnCallQuery, resolveAdminOnlyValue, withApiDetails, type OnCallQueryModelRequest } from '@dereekb/firebase-server';
import { type DemoQueryModelFunction, type DemoApiNestContext } from '../function.context';

export const queryGuestbooks: DemoQueryModelFunction<QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>> = withApiDetails({
  mcp: { description: 'Query guestbooks with optional filtering by published status' },
  fn: async (request: OnCallQueryModelRequest<DemoApiNestContext, QueryGuestbooksParams>) => {
    const { nest, data } = request;

    const published = resolveAdminOnlyValue({
      request,
      value: data.published,
      defaultValue: true,
      isAdminOnlyValue: (v) => v !== true,
      messageOrError: { message: 'Users can only search published guestbooks.' }
    });

    return executeOnCallQuery<Guestbook>({
      params: data,
      collection: nest.demoFirestoreCollections.guestbookCollection,
      loadCursorDocument: async (key) => {
        const doc = await nest.useModel('guestbook', {
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
          constraints.push(publishedGuestbook(published));
        }

        return constraints;
      }
    });
  }
});
