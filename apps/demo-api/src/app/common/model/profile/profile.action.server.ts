import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { AsyncProfileUpdateAction, ProfileDocument, ProfileFirestoreCollections, profileWithUsername, SetProfileUsernameParams } from "@dereekb/demo-firebase";

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections { }

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract setProfileUsername(params: SetProfileUsernameParams): AsyncProfileUpdateAction<SetProfileUsernameParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    setProfileUsername: setProfileUsernameFactory(context)
  };
}

// MARK: Actions
export function setProfileUsernameFactory({ firebaseServerActionTransformFactory, profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return firebaseServerActionTransformFactory(SetProfileUsernameParams, async (params) => {
    const { username } = params;

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
        const docs = await queryProfile(profileWithUsername(username)).getDocs(transaction);

        if (docs.empty) {
          const documentInTransaction = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);
          const profilePrivateDataDocument = profilePrivateDataCollectionFactory(document).loadDocumentForTransaction(transaction);

          // update the username
          await documentInTransaction.accessor.update({ username });

          // update the data on the accessor
          const profilePrivateData = profilePrivateDataDocument;
          await profilePrivateData.accessor.set({
            usernameSetAt: new Date()
          }, { merge: true });

        } else {
          throw new Error('This username is already taken.');
        }
      });

      return document;
    };
  });
}
