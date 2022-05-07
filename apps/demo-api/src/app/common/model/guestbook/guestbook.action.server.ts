import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { GuestbookDocument, GuestbookFirestoreCollections, UpdateGuestbookEntryParams, AsyncGuestbookEntryUpdateAction, GuestbookEntryDocument } from "@dereekb/demo-firebase";

/**
 * FirebaseServerActionsContextt required for GuestbookServerActions.
 */
export interface GuestbookServerActionsContext extends FirebaseServerActionsContext, GuestbookFirestoreCollections { }

/**
 * Server-only guestbook actions.
 */
export abstract class GuestbookServerActions {
  abstract updateGuestbookEntry(params: UpdateGuestbookEntryParams): AsyncGuestbookEntryUpdateAction<UpdateGuestbookEntryParams>;
}

/**
 * Factory for generating GuestbookServerActions for a given context.
 */
export function guestbookServerActions(context: GuestbookServerActionsContext): GuestbookServerActions {
  return {
    updateGuestbookEntry: updateGuestbookEntryFactory(context)
  };
}

// MARK: Actions
export function updateGuestbookEntryFactory({ firebaseServerActionTransformFunctionFactory, guestbookFirestoreCollection, guestbookEntryCollectionFactory }: GuestbookServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateGuestbookEntryParams, async (params) => {
    const { message, signed } = params;

    return async (document: GuestbookEntryDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await guestbookFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
        const parentGuestbook = guestbookFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(document.parent);
        const guestbookSnapshot = await parentGuestbook.snapshot();
        const guestbookData = guestbookSnapshot.data();

        if (!guestbookData) {
          throw new Error('The guestbook could not be found.');
        } else if (guestbookData.locked) {
          throw new Error('The guestbook has been locked.');
        } else {
          const documentInTransaction = guestbookEntryCollectionFactory(parentGuestbook).documentAccessorForTransaction(transaction).loadDocument(documentRef);

          // set the message and signed
          await documentInTransaction.accessor.set({
            message,
            signed,
            updatedAt: new Date() // update the updated at time
          }, { merge: true });
        }
      });

      return document;
    };
  });
}
