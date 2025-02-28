import { FirebaseServerActionsContext, assertSnapshotData } from '@dereekb/firebase-server';
import { GuestbookFirestoreCollections, InsertGuestbookEntryParams, AsyncGuestbookEntryUpdateAction, GuestbookEntryDocument, GuestbookEntry, CreateGuestbookParams, AsyncGuestbookCreateAction, GuestbookDocument, guestbookEntryCreatedNotificationTemplate, LikeGuestbookEntryParams, guestbookEntryLikedNotificationTemplate } from '@dereekb/demo-firebase';
import { FirestoreContextReference, NotificationFirestoreCollections, createNotificationDocument } from '@dereekb/firebase';

/**
 * FirebaseServerActionsContextt required for GuestbookServerActions.
 */
export interface GuestbookServerActionsContext extends FirebaseServerActionsContext, GuestbookFirestoreCollections, NotificationFirestoreCollections, FirestoreContextReference {}

/**
 * Server-only guestbook actions.
 */
export abstract class GuestbookServerActions {
  abstract createGuestbook(params: CreateGuestbookParams): AsyncGuestbookCreateAction<CreateGuestbookParams>;
  abstract insertGuestbookEntry(params: InsertGuestbookEntryParams): AsyncGuestbookEntryUpdateAction<InsertGuestbookEntryParams>;
  abstract likeGuestbookEntry(params: LikeGuestbookEntryParams): AsyncGuestbookEntryUpdateAction<LikeGuestbookEntryParams>;
}

/**
 * Factory for generating GuestbookServerActions for a given context.
 */
export function guestbookServerActions(context: GuestbookServerActionsContext): GuestbookServerActions {
  return {
    createGuestbook: guestbookCreateGuestbookFactory(context),
    insertGuestbookEntry: guestbookEntryInsertEntryFactory(context),
    likeGuestbookEntry: likeGuestbookEntryFactory(context)
  };
}

// MARK: Actions
export function guestbookCreateGuestbookFactory({ firebaseServerActionTransformFunctionFactory, guestbookCollection }: GuestbookServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(CreateGuestbookParams, async (params) => {
    const guestbookAccessor = guestbookCollection.documentAccessor();
    const { name, published } = params;

    return async () => {
      const document: GuestbookDocument = guestbookAccessor.newDocument();

      // create a guestbook
      await document.create({
        name,
        published: published || false,
        locked: false
      });

      return document;
    };
  });
}

export function guestbookEntryInsertEntryFactory(context: GuestbookServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, guestbookCollection, guestbookEntryCollectionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(InsertGuestbookEntryParams, async (params) => {
    const { message, signed, published } = params;

    return async (document: GuestbookEntryDocument) => {
      const documentRef = document.documentRef;
      const uid = document.id;

      // perform the change in a transaction
      await guestbookCollection.firestoreContext.runTransaction(async (transaction) => {
        const guestbookDocument = guestbookCollection.documentAccessorForTransaction(transaction).loadDocument(document.parent);
        const guestbookEntryDocument = guestbookEntryCollectionFactory(guestbookDocument).documentAccessorForTransaction(transaction).loadDocument(documentRef);
        const [guestbook, guestbookEntry] = await Promise.all([guestbookDocument.snapshotData(), guestbookEntryDocument.snapshotData()]);

        if (!guestbook) {
          throw new Error('The guestbook could not be found.');
        } else if (guestbook.locked) {
          throw new Error('The guestbook has been locked.'); // TODO: Change to more concrete errors
        } else {
          const set: Partial<GuestbookEntry> = {
            message,
            signed,
            published,
            updatedAt: new Date() // update the updated at time
          };

          // create or update the value
          if (guestbookEntry == null) {
            // create a new entry
            await guestbookEntryDocument.create(set as GuestbookEntry);

            // also create a notification for the guestbook
            await createNotificationDocument({
              transaction,
              context,
              template: guestbookEntryCreatedNotificationTemplate({
                guestbookKey: guestbookDocument
              })
            });
          } else {
            await guestbookEntryDocument.update(set);
          }
        }
      });

      return document;
    };
  });
}

export function likeGuestbookEntryFactory(context: GuestbookServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory, guestbookCollection, guestbookEntryCollectionGroup } = context;

  return firebaseServerActionTransformFunctionFactory(LikeGuestbookEntryParams, async (params) => {
    return async (document: GuestbookEntryDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const guestbookEntryDocumentInTransaction = guestbookEntryCollectionGroup.documentAccessorForTransaction(transaction).loadDocumentFrom(document);
        const guestbookEntry = await assertSnapshotData(guestbookEntryDocumentInTransaction);

        if (!guestbookEntry.published) {
          throw new Error('The guestbook entry is not published.');
        }

        // increase the number of likes by 1
        await guestbookEntryDocumentInTransaction.accessor.increment({ likes: 1 });

        // create a new notification
        await createNotificationDocument({
          transaction,
          context,
          template: guestbookEntryLikedNotificationTemplate({
            guestbookEntryKey: document.key
          })
        });
      });

      return document;
    };
  });
}
