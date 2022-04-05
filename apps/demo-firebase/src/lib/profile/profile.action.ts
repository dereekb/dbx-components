import { ProfileDocument, ProfileFirestoreCollection, ProfilePrivateDataFirestoreCollection, ProfilePrivateDataFirestoreCollectionFactory } from "./profile";
import { profileWithUsername } from "./profile.query";

export type ProfileUpdateAction = (document: ProfileDocument) => Promise<ProfileDocument>;

export class ProfileUsernameTakenError extends Error { }

export abstract class ProfileActions { }

export function profileActions(firestoreCollection: ProfileFirestoreCollection): ProfileActions {
  const { query } = firestoreCollection;
  return {};
}

/**
 * Server-only profile actions,.
 */
export abstract class ProfileServerActions {
  abstract setProfileUsername(username: string): ProfileUpdateAction;
}

/**
 * Factory for generating ProfileServerActions for a given context.
 */
export function profileServerActions({
  profileFirestoreCollection,
  profilePrivateDataCollectionFactory
}: {
  profileFirestoreCollection: ProfileFirestoreCollection,
  profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory
}): ProfileServerActions {
  const { query: queryProfile } = profileFirestoreCollection;

  return {
    ...profileActions(profileFirestoreCollection),
    setProfileUsername(username: string) {
      return async (document: ProfileDocument) => {
        const documentRef = document.documentRef;

        // perform the change in a transaction
        await profileFirestoreCollection.firestoreContext.runTransaction(async (transaction) => {
          const docs = await queryProfile(profileWithUsername(username)).getDocs();

          if (docs.empty) {
            const documentInTransaction = profileFirestoreCollection.documentAccessorForTransaction(transaction).loadDocument(documentRef);
            const childCollectionAccessor = profilePrivateDataCollectionFactory(document).documentAccessorForTransaction(transaction);

            // update the username
            await document.accessor.update({ username });

            // update the data on the accessor
            const profilePrivateData = childCollectionAccessor.loadDocumentForPath(documentInTransaction.id);
            await profilePrivateData.accessor.update({
              usernameSetAt: new Date()
            });

          } else {
            throw new Error('This username is already taken.');
          }
        });

        return document;
      };
    }
  }
}
