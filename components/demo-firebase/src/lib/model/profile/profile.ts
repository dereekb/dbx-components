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

/**
 * Returns the root Firestore collection reference for Profile documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the profile collection.
 */
export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> {
  return context.collection(profileIdentity.collectionName);
}

export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;

/**
 * Creates the Firestore collection accessor for Profile documents,
 * wiring the converter, model identity, accessor factory, and document factory together.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns A ProfileFirestoreCollection for querying and accessing profile documents.
 */
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

/**
 * Creates a factory function that returns the subcollection reference for
 * ProfilePrivateData documents under a given Profile parent document.
 *
 * @param context - The FirestoreContext used to resolve the subcollection.
 * @returns A function that accepts a ProfileDocument and returns its ProfilePrivateData subcollection reference.
 */
export function profilePrivateDataCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivateData> {
  return (profile: ProfileDocument) => {
    return context.subcollection(profile.documentRef, profilePrivateDataIdentity.collectionName);
  };
}

export type ProfilePrivateDataFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivateData, Profile, ProfilePrivateDataDocument>;
export type ProfilePrivateDataFirestoreCollectionFactory = (parent: ProfileDocument) => ProfilePrivateDataFirestoreCollection;

/**
 * Creates a factory that produces ProfilePrivateData single-item Firestore collection
 * accessors scoped to a specific parent Profile document.
 *
 * @param firestoreContext - The FirestoreContext used to build the subcollection.
 * @returns A factory function that accepts a ProfileDocument parent and returns its ProfilePrivateData collection.
 */
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

/**
 * Returns the collection group reference for all ProfilePrivateData documents
 * across every parent Profile, enabling cross-profile queries.
 *
 * @param context - The FirestoreContext used to resolve the collection group.
 * @returns A CollectionGroup reference for ProfilePrivateData documents.
 */
export function profilePrivateDataCollectionReference(context: FirestoreContext): CollectionGroup<ProfilePrivateData> {
  return context.collectionGroup(profilePrivateDataIdentity.collectionName);
}

export type ProfilePrivateDataFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivateData, ProfilePrivateDataDocument>;

/**
 * Creates the Firestore collection group accessor for ProfilePrivateData documents,
 * allowing queries across all profile private data subcollections.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection group.
 * @returns A ProfilePrivateDataFirestoreCollectionGroup for cross-parent profile private data queries.
 */
export function profilePrivateDataFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateDataFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: profilePrivateDataIdentity,
    converter: profilePrivateDataConverter,
    queryLike: profilePrivateDataCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDataDocument(accessor, documentAccessor),
    firestoreContext
  });
}
