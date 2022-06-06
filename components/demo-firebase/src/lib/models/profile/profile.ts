import { firestoreModelIdentity, CollectionReference, AbstractFirestoreDocument, snapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext, SingleItemFirestoreCollection, optionalFirestoreString, CollectionGroup, FirestoreCollectionGroup } from '@dereekb/firebase';
import { GrantedReadRole } from '@dereekb/model';
import { Maybe } from '@dereekb/util';

export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateDataCollectionFactory: ProfilePrivateDataFirestoreCollectionFactory;
  profilePrivateDataCollectionGroup: ProfilePrivateDataFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateDataIdentity;

// MARK: Profile
export const profileIdentity = firestoreModelIdentity('profile', 'pr');

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

export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument> {
  get modelIdentity() {
    return profileIdentity;
  }
}

export const profileConverter = snapshotConverterFunctions<Profile>({
  fields: {
    username: firestoreString({ default: '', defaultBeforeSave: null }),
    bio: optionalFirestoreString(),
    updatedAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> {
  return context.collection(profileIdentity.collection).withConverter<Profile>(profileConverter);
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
export const profilePrivateDataIdentity = firestoreModelIdentity('profilePrivate', 'prp');

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

export class ProfilePrivateDataDocument extends AbstractFirestoreDocument<ProfilePrivateData, ProfilePrivateDataDocument> {
  get modelIdentity() {
    return profilePrivateDataIdentity;
  }
}

export const profilePrivateDataIdentifier = '0';

export const profilePrivateDataConverter = snapshotConverterFunctions<ProfilePrivateData>({
  fields: {
    usernameSetAt: firestoreDate({ saveDefaultAsNow: false }),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function profilePrivateDataCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivateData> {
  return (profile: ProfileDocument) => {
    return context.subcollection(profile.documentRef, profilePrivateDataIdentity.collection).withConverter<ProfilePrivateData>(profilePrivateDataConverter);
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
  return context.collectionGroup(profilePrivateDataIdentity.collection).withConverter<ProfilePrivateData>(profilePrivateDataConverter);
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
