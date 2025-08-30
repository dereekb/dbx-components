import { FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { AsyncProfileUpdateAction, exampleNotificationTemplate, ProfileCreateTestNotificationParams, ProfileDocument, ProfileFirestoreCollections, profileWithUsername, SetProfileUsernameParams, UpdateProfileParams } from 'demo-firebase';
import { type Maybe } from '@dereekb/util';
import { NotificationFirestoreCollections, FirestoreContextReference, createNotificationDocument, twoWayFlatFirestoreModelKey, NotificationSummaryId } from '@dereekb/firebase';
import { usernameAlreadyTakenError } from './profile.error';
import { NotificationExpediteServiceRef } from '@dereekb/firebase-server/model';

/**
 * FirebaseServerActionsContextt required for ProfileServerActions.
 */
export interface ProfileServerActionsContext extends FirebaseServerActionsContext, ProfileFirestoreCollections, NotificationFirestoreCollections, FirestoreContextReference, NotificationExpediteServiceRef {}

/**
 * Server-only profile actions.
 */
export abstract class ProfileServerActions {
  abstract initProfileForUid(uid: string): Promise<ProfileDocument>;
  abstract updateProfile(params: UpdateProfileParams): AsyncProfileUpdateAction<UpdateProfileParams>;
  abstract setProfileUsername(params: SetProfileUsernameParams): AsyncProfileUpdateAction<SetProfileUsernameParams>;
  abstract createTestNotification(params: ProfileCreateTestNotificationParams): AsyncProfileUpdateAction<ProfileCreateTestNotificationParams>;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions(context: ProfileServerActionsContext): ProfileServerActions {
  return {
    initProfileForUid: initProfileForUidFactory(context),
    updateProfile: updateProfileFactory(context),
    setProfileUsername: setProfileUsernameFactory(context),
    createTestNotification: createTestNotificationFactory(context)
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
          usernameSetAt: new Date(),
          createdAt: new Date()
        });
      }

      return profile!;
    });

    return profile;
  };
}

export function setProfileUsernameFactory({ firebaseServerActionTransformFunctionFactory, profileCollection: profileFirestoreCollection, profilePrivateDataCollectionFactory }: ProfileServerActionsContext) {
  const { query: queryProfile } = profileFirestoreCollection;

  return firebaseServerActionTransformFunctionFactory(SetProfileUsernameParams, async (params) => {
    const { username: inputUsername } = params;
    const username = inputUsername.toLowerCase();

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      // perform the change in a transaction
      await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
        // check that there are any conflicts with other profiles
        const conflictingDoc = await queryProfile(profileWithUsername(username)).getFirstDoc(transaction);

        if (conflictingDoc) {
          if (conflictingDoc.id !== documentRef.id) {
            throw usernameAlreadyTakenError(username);
          }
        }

        const documentInTransaction = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);
        const profilePrivateDataDocument = profilePrivateDataCollectionFactory(documentInTransaction).loadDocumentForTransaction(transaction);

        // update the username
        const snapshot = await documentInTransaction.snapshotData();

        // TODO: Can also check if the user is banned or not, etc.

        if (snapshot?.username !== username) {
          await documentInTransaction.accessor.set({ username }, { merge: true });

          // update the data on the accessor
          const profilePrivateData = profilePrivateDataDocument;
          await profilePrivateData.accessor.set(
            {
              usernameSetAt: new Date()
            },
            { merge: true }
          );
        }
      });

      return document;
    };
  });
}

export function updateProfileFactory({ firebaseServerActionTransformFunctionFactory, profileCollection: profileFirestoreCollection }: ProfileServerActionsContext) {
  return firebaseServerActionTransformFunctionFactory(UpdateProfileParams, async (params) => {
    const { bio } = params;

    return async (document: ProfileDocument) => {
      const documentRef = document.documentRef;

      const profile = profileFirestoreCollection.documentAccessor().loadDocument(documentRef);
      await profile.accessor.set({ bio }, { merge: true });
      return document;
    };
  });
}

export function createTestNotificationFactory(context: ProfileServerActionsContext) {
  const { notificationExpediteService, firebaseServerActionTransformFunctionFactory, notificationSummaryCollection } = context;

  return firebaseServerActionTransformFunctionFactory(ProfileCreateTestNotificationParams, async (params) => {
    const { skipSend, expediteSend } = params;

    return async (document: ProfileDocument) => {
      const expediteInstance = notificationExpediteService.expediteInstance();

      // load the existing notification summary if it exists and check number of
      const notificationSummaryId = twoWayFlatFirestoreModelKey(document.key);
      const notificationSummaryDocument = notificationSummaryCollection.documentAccessor().loadDocumentForId(notificationSummaryId as NotificationSummaryId);

      const notificationSummary = await notificationSummaryDocument.snapshotData();

      if ((notificationSummary?.n.length ?? 0) > 6) {
        throw new Error('Too many test notifications.');
      }

      // create a new notification
      const createResult = await createNotificationDocument({
        context,
        template: exampleNotificationTemplate({
          profileDocument: document,
          skipSend
        })
      });

      if (expediteSend) {
        expediteInstance.enqueueCreateResult(createResult);
        await expediteInstance.send();
      }

      return document;
    };
  });
}
