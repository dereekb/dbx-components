import { firestoreModelIdentity, type CollectionReference, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString, firestoreDate, type FirestoreCollection, type UserRelatedById, type FirestoreContext, type SingleItemFirestoreCollection, optionalFirestoreString, type CollectionGroup, type FirestoreCollectionGroup, type UserRelated, copyUserRelatedDataAccessorFactoryFunction, firestoreUID, type StorageFileKey } from '@dereekb/firebase';
import { type GrantedReadRole } from '@dereekb/model';
import { type WebsiteUrl, type Maybe } from '@dereekb/util';

export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateDataIdentity;

// MARK: Profile
export const profileIdentity = firestoreModelIdentity('profile', 'pr');

export interface Profile extends UserRelated, UserRelatedById {
  /**
   * Avatar URL
   */
  avatar?: Maybe<WebsiteUrl>;
  /**
   * Avatar storage file
   */
  avatarStorageFile?: Maybe<StorageFileKey>;
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

export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument, typeof profileIdentity> {
  get modelIdentity() {
    return profileIdentity;
  }
}

export const profileConverter = snapshotConverterFunctions<Profile>({
  fields: {
    uid: firestoreUID(),
    avatar: optionalFirestoreString(),
    avatarStorageFile: optionalFirestoreString(),
    username: firestoreString({ default: '', defaultBeforeSave: null }),
    bio: optionalFirestoreString(),
    updatedAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export const profileAccessorFactory = copyUserRelatedDataAccessorFactoryFunction<Profile>();

export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> {
  return context.collection(profileIdentity.collectionName);
}

export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;

export function profileFirestoreCollection(firestoreContext: FirestoreContext): ProfileFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: profileIdentity,
    converter: profileConverter,
    accessorFactory: profileAccessorFactory,
    collection: profileCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfileDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Profile Private Data
export const profilePrivateDataIdentity = firestoreModelIdentity(profileIdentity, 'profilePrivate', 'prp');

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

export type ProfilePrivateDataRoles = 'owner' | GrantedReadRole;

export class ProfilePrivateDataDocument extends AbstractFirestoreDocument<ProfilePrivateData, ProfilePrivateDataDocument, typeof profilePrivateDataIdentity> {
  get modelIdentity() {
    return profilePrivateDataIdentity;
  }
}

export const profilePrivateDataConverter = snapshotConverterFunctions<ProfilePrivateData>({
  fields: {
    usernameSetAt: firestoreDate({ saveDefaultAsNow: false }),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function profilePrivateDataCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivateData> {
  return (profile: ProfileDocument) => {
    return context.subcollection(profile.documentRef, profilePrivateDataIdentity.collectionName);
  };
}

export type ProfilePrivateDataFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivateData, Profile, ProfilePrivateDataDocument>;
export type ProfilePrivateDataFirestoreCollectionFactory = (parent: ProfileDocument) => ProfilePrivateDataFirestoreCollection;

export function profilePrivateDataFirestoreCollectionFactory(firestoreContext: FirestoreContext): ProfilePrivateDataFirestoreCollectionFactory {
  const factory = profilePrivateDataCollectionReferenceFactory(firestoreContext);

  return (parent: ProfileDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      modelIdentity: profilePrivateDataIdentity,
      converter: profilePrivateDataConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new ProfilePrivateDataDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

export function profilePrivateDataCollectionReference(context: FirestoreContext): CollectionGroup<ProfilePrivateData> {
  return context.collectionGroup(profilePrivateDataIdentity.collectionName);
}

export type ProfilePrivateDataFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivateData, ProfilePrivateDataDocument>;

export function profilePrivateDataFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateDataFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: profilePrivateDataIdentity,
    converter: profilePrivateDataConverter,
    queryLike: profilePrivateDataCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDataDocument(accessor, documentAccessor),
    firestoreContext
  });
}
