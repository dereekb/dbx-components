import { CollectionReference, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext, SingleItemFirestoreCollection, optionalFirestoreString, CollectionGroup, FirestoreCollectionGroup } from '@dereekb/firebase';
import { GrantedReadRole } from '@dereekb/model';
import { Maybe } from '@dereekb/util';

export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileCollectionPath | typeof profileCollectionProfilePrivateDataCollectionPath;

// MARK: Profile
export interface Profile extends UserRelatedById {
  /**
   * Unique username.
   */
  username: string;
  /**
   * Profile biography
   */
  bio?: Maybe<string>;
  /**
   * Last date the profile was updated at.
   */
  updatedAt: Date;
}

export type ProfileRoles = 'owner' | GrantedReadRole;

export interface ProfileRef extends DocumentReferenceRef<Profile> {}

export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument> {}

export const profileCollectionPath = 'profile';

export const profileConverter = snapshotConverterFunctions<Profile>({
  fields: {
    username: firestoreString({ default: '', defaultBeforeSave: null }),
    bio: optionalFirestoreString(),
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

// MARK: Profile Private Data
export interface ProfilePrivateData {
  /**
   * Date the username was set at.
   */
  usernameSetAt: Date;
  /**
   * Date the profile was created at.
   */
  createdAt: Date;
}

export interface ProfilePrivateDataRef extends DocumentReferenceRef<ProfilePrivateData> {}

export type ProfilePrivateDataRoles = 'owner' | GrantedReadRole;

export class ProfilePrivateDataDocument extends AbstractFirestoreDocument<ProfilePrivateData, ProfilePrivateDataDocument> {}

export const profileCollectionProfilePrivateDataCollectionPath = 'profileprivate';
export const profilePrivateDataIdentifier = '0';

export const profilePrivateDataConverter = snapshotConverterFunctions<ProfilePrivateData>({
  fields: {
    usernameSetAt: firestoreDate({ saveDefaultAsNow: false }),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function profilePrivateDataCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivateData> {
  return (profile: ProfileDocument) => {
    return context.subcollection(profile.documentRef, profileCollectionProfilePrivateDataCollectionPath).withConverter<ProfilePrivateData>(profilePrivateDataConverter);
  };
}

export type ProfilePrivateDataFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivateData, Profile, ProfilePrivateDataDocument>;
export type ProfilePrivateDataFirestoreCollectionFactory = (parent: ProfileDocument) => ProfilePrivateDataFirestoreCollection;

export function profilePrivateDataFirestoreCollectionFactory(firestoreContext: FirestoreContext): ProfilePrivateDataFirestoreCollectionFactory {
  const factory = profilePrivateDataCollectionReferenceFactory(firestoreContext);

  return (parent: ProfileDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      itemsPerPage: 50,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new ProfilePrivateDataDocument(accessor, documentAccessor),
      firestoreContext,
      parent,
      singleItemIdentifier: profilePrivateDataIdentifier
    });
  };
}

export function profilePrivateDataCollectionReference(context: FirestoreContext): CollectionGroup<ProfilePrivateData> {
  return context.collectionGroup(profileCollectionProfilePrivateDataCollectionPath).withConverter<ProfilePrivateData>(profilePrivateDataConverter);
}

export type ProfilePrivateDataFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivateData, ProfilePrivateDataDocument>;

export function profilePrivateDataFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateDataFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    itemsPerPage: 50,
    queryLike: profilePrivateDataCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDataDocument(accessor, documentAccessor),
    firestoreContext
  });
}
