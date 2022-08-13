import { FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { GuestbookFirestoreCollections, UpdateGuestbookEntryParams, AsyncGuestbookEntryUpdateAction, GuestbookEntryDocument, GuestbookEntry, CreateGuestbookParams, AsyncGuestbookCreateAction, GuestbookDocument } from '@dereekb/demo-firebase';

/**
 * FirebaseServerActionsContextt required for GuestbookServerActions.
 */
export interface GuestbookServerActionsContext extends FirebaseServerActionsContext, GuestbookFirestoreCollections {}

/**
 * Server-only guestbook actions.
 */
export abstract class GuestbookServerActions {
  abstract createGuestbook(params: CreateGuestbookParams): AsyncGuestbookCreateAction<CreateGuestbookParams>;
  abstract updateGuestbookEntry(params: UpdateGuestbookEntryParams): AsyncGuestbookEntryUpdateAction<UpdateGuestbookEntryParams>;
}

/**
 * Factory for generating GuestbookServerActions for a given context.
 */
export function guestbookServerActions(context: GuestbookServerActionsContext): GuestbookServerActions {
  return {
    createGuestbook: guestbookCreateGuestbookFactory(context),
    updateGuestbookEntry: guestbookEntryUpdateEntryFactory(context)
  };
}

// MARK: Actions
export function guestbookCreateGuestbookFactory({ firebaseServerActionTransformFunctionFactory, guestbookCollection }: GuestbookServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(CreateGuestbookParams, async (params) => {
    const guestbookAccessor = guestbookCollection.documentAccessor();
    const { name } = params;

    return async () => {
      const document: GuestbookDocument = guestbookAccessor.newDocument();

      await document.create({
        name,
        published: false,
        locked: false
      });

      return document;
    };
  });
}

export function guestbookEntryUpdateEntryFactory({ firebaseServerActionTransformFunctionFactory, guestbookCollection, guestbookEntryCollectionFactory }: GuestbookServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateGuestbookEntryParams, async (params) => {
    const { message, signed, published } = params;

    return async (document: GuestbookEntryDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await guestbookCollection.firestoreContext.runTransaction(async (transaction) => {
        const parentGuestbook = guestbookCollection.documentAccessorForTransaction(transaction).loadDocument(document.parent);
        const guestbookEntryDocument = guestbookEntryCollectionFactory(parentGuestbook).documentAccessorForTransaction(transaction).loadDocument(documentRef);
        const [guestbook, guestbookEntry] = await Promise.all([parentGuestbook.snapshotData(), guestbookEntryDocument.snapshotData()]);

        if (!guestbook) {
          throw new Error('The guestbook could not be found.');
        } else if (guestbook.locked) {
          throw new Error('The guestbook has been locked.');
        } else {
          const set: Partial<GuestbookEntry> = {
            message,
            signed,
            published,
            updatedAt: new Date() // update the updated at time
          };

          // create or update the value
          if (guestbookEntry == null) {
            await guestbookEntryDocument.create(set as GuestbookEntry);
          } else {
            await guestbookEntryDocument.update(set);
          }
        }
      });

      return document;
    };
  });
}
