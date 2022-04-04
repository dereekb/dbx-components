import { CollectionReference, AbstractFirestoreDocument, makeSnapshotConverterFunctions, firestoreUID, firestoreString, firestoreDate, makeFirestoreCollection, FirestoreDocumentDataAccessor, FirestoreCollection, UserRelated, DocumentReferenceRef, FirestoreContext } from "@dereekb/firebase";

export interface Profile extends UserRelated {
  /**
   * Unique username
   */
  username: string;
  /**
   * Last date the profile was updated at.
   */
  updatedAt: Date;
}

export interface ProfileRef extends DocumentReferenceRef<Profile> { }

export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument> { }

export const profileCollectionPath = 'profile';

export const profileConverter = makeSnapshotConverterFunctions<Profile>({
  fields: {
    uid: firestoreUID(),
    username: firestoreString({}),
    updatedAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> {
  return context.collection(profileCollectionPath).withConverter<Profile>(profileConverter);
}

export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;

export function profileFirestoreCollection(firestoreContext: FirestoreContext): ProfileFirestoreCollection {
  return firestoreContext.firestoreCollection({
    itemsPerPage: 50,
    collection: profileCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfileDocument(accessor, documentAccessor),
    firestoreContext
  });
}
