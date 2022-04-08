import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { AsyncProfileUpdateAction, ProfileDocument, ProfileFirestoreCollections, profileWithUid, profileWithUsername, SetProfileUsernameParams } from "@dereekb/demo-firebase";
import { Maybe } from "@dereekb/util";

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections { }

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract initProfileForUid(uid: string): Promise<ProfileDocument>;
  abstract setProfileUsername(params: SetProfileUsernameParams): AsyncProfileUpdateAction<SetProfileUsernameParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    initProfileForUid: initProfileForUidFactory(context),
    setProfileUsername: setProfileUsernameFactory(context)
  };
}

// MARK: Actions
export function initProfileForUidFactory({ profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { queryDocument } = profileFirestoreCollection;

  return async (uid: string) => {

    // init within a transaction.
    const profile = await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
      let profile: Maybe<ProfileDocument> = await queryDocument(profileWithUid(uid)).getFirstDoc();

      if (!profile) {
        profile = profileFirestoreCollection.documentAccessorForTransaction(transaction).newDocument();

        // create the profile
        await profile.accessor.set({
          uid,
          username: uid,
          updatedAt: new Date()
        });

        // create the private profile data
        const profilePrivateData = profilePrivateDataCollectionFactory(profile);
        await profilePrivateData.loadDocument().accessor.set({
          usernameSetAt: new Date(),
          createdAt: new Date()
        });
      }

      return profile!;
    });

    return profile;
  };
}

export function setProfileUsernameFactory({ firebaseServerActionTransformFunctionFactory, profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return firebaseServerActionTransformFunctionFactory(SetProfileUsernameParams, async (params) => {
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
