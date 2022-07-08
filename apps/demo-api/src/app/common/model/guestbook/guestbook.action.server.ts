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

      await document.createOrUpdate({ name });

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
        const guestbookSnapshot = await parentGuestbook.snapshot();
        const guestbookData = guestbookSnapshot.data();

        if (!guestbookData) {
          throw new Error('The guestbook could not be found.');
        } else if (guestbookData.locked) {
          throw new Error('The guestbook has been locked.');
        } else {
          const documentInTransaction = guestbookEntryCollectionFactory(parentGuestbook).documentAccessorForTransaction(transaction).loadDocument(documentRef);

          const set: Partial<GuestbookEntry> = {
            message,
            signed,
            published,
            updatedAt: new Date() // update the updated at time
          };

          // create or update the value
          await documentInTransaction.createOrUpdate(set);
        }
      });

      return document;
    };
  });
}
