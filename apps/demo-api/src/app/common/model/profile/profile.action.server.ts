import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { AsyncProfileUpdateAction, ProfileDocument, ProfileFirestoreCollections, profileWithUsername, SetProfileUsernameParams, UpdateProfileParams } from "@dereekb/demo-firebase";
import { containsStringAnyCase, Maybe } from "@dereekb/util";

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections { }

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract initProfileForUid(uid: string): Promise<ProfileDocument>;
  abstract updateProfile(params: UpdateProfileParams): AsyncProfileUpdateAction<UpdateProfileParams>;
  abstract setProfileUsername(params: SetProfileUsernameParams): AsyncProfileUpdateAction<SetProfileUsernameParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    initProfileForUid: initProfileForUidFactory(context),
    updateProfile: updateProfileFactory(context),
    setProfileUsername: setProfileUsernameFactory(context)
  };
}

// MARK: Actions
export function initProfileForUidFactory({ profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return async (uid: string) => {

    // init within a transaction.
    const profile = await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
      let profile: Maybe<ProfileDocument> = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocumentForPath(uid);

      const exists = await profile.accessor.exists();

      if (!exists) {
        let username = uid;
        const docs = await queryProfile(profileWithUsername(username)).getDocs(transaction);

        if (!docs.empty) {
          username = `${uid}-1`;  // "-" isn't allowed in usernames by users, so this name should be safe.
        }

        // create the profile
        await profile.accessor.set({
          username,
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
    const { username: inputUsername } = params;
    const username = inputUsername.toLowerCase();

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
        const docs = await queryProfile(profileWithUsername(username)).getDocs(transaction);

        if (!docs.empty) {

          const usernames = docs.docs.map((x) => {
            const { username: docUsername } = x.data();
            return docUsername;
          });

          if (containsStringAnyCase(usernames, username)) {
            throw new Error('This username is already taken.');
          }
        }

        const documentInTransaction = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);
        const profilePrivateDataDocument = profilePrivateDataCollectionFactory(document).loadDocumentForTransaction(transaction);

        // update the username
        const snapshot = await documentInTransaction.snapshotData();

        // TODO: Can also check if the user is banned or not, etc.

        if (snapshot?.username !== username) {
          await documentInTransaction.accessor.set({ username }, { merge: true });

          // update the data on the accessor
          const profilePrivateData = profilePrivateDataDocument;
          await profilePrivateData.accessor.set({
            usernameSetAt: new Date()
          }, { merge: true });
        }
      });

      return document;
    };
  });
}


export function updateProfileFactory({ firebaseServerActionTransformFunctionFactory, profileFirestoreCollection }: ProfileServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateProfileParams, async (params) => {
    const { bio } = params;

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      const profile = profileFirestoreCollection.documentAccessor().loadDocument(documentRef);
      await profile.accessor.set({ bio }, { merge: true })
      return document;
    };
  });
}
