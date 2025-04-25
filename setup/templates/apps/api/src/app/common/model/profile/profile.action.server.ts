import { FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { AsyncProfileUpdateAction, ProfileDocument, ProfileFirestoreCollections, UpdateProfileParams } from 'FIREBASE_COMPONENTS_NAME';
import { containsStringAnyCase, type Maybe } from '@dereekb/util';
import { NotificationFirestoreCollections, FirestoreContextReference, createNotificationDocument, twoWayFlatFirestoreModelKey, NotificationSummaryId } from '@dereekb/firebase';

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections, NotificationFirestoreCollections, FirestoreContextReference {}

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract initProfileForUid(uid: string): Promise<ProfileDocument>;
  abstract updateProfile(params: UpdateProfileParams): AsyncProfileUpdateAction<UpdateProfileParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    initProfileForUid: initProfileForUidFactory(context),
    updateProfile: updateProfileFactory(context)
  };
}

// MARK: Actions
export function initProfileForUidFactory({ profileCollection: profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return async (uid: string) => {
    // init within a transaction.
    const profile = await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
      const profile: Maybe<ProfileDocument> = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocumentForId(uid);

      const exists = await profile.accessor.exists();

      if (!exists) {
        let username = uid;
        const docs = await queryProfile(profileWithUsername(username)).getDocs(transaction);

        if (!docs.empty) {
          username = `${uid}-1`; // "-" isn't allowed in usernames by users, so this name should be safe.
        }

        // create the profile
        await profile.accessor.set({
          uid,
          username,
          updatedAt: new Date()
        });

        // create the private profile data
        const profilePrivateData = profilePrivateDataCollectionFactory(profile);
        await profilePrivateData.loadDocument().accessor.set({
          createdAt: new Date()
        });
      }

      return profile!;
    });

    return profile;
  };
}

export function updateProfileFactory({ firebaseServerActionTransformFunctionFactory, profileCollection: profileFirestoreCollection }: ProfileServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateProfileParams, async (params) => {
    const {} = params;

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      const profile = profileFirestoreCollection.documentAccessor().loadDocument(documentRef);
      await profile.accessor.set({}, { merge: true });
      return document;
    };
  });
}
