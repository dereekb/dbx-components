import {
  firestoreModelIdentity,
  type CollectionReference,
  AbstractFirestoreDocument,
  snapshotConverterFunctions,
  firestoreString,
  firestoreDate,
  firestoreEnum,
  firestoreSubObject,
  type FirestoreCollection,
  type UserRelatedById,
  type FirestoreContext,
  type SingleItemFirestoreCollection,
  optionalFirestoreBoolean,
  optionalFirestoreDate,
  optionalFirestoreString,
  type CollectionGroup,
  type FirestoreCollectionGroup,
  type UserRelated,
  copyUserRelatedDataAccessorFactoryFunction,
  firestoreUID,
  type StorageFileKey
} from '@dereekb/firebase';
import { type GrantedReadRole } from '@dereekb/model';
import { type WebsiteUrl, type Maybe } from '@dereekb/util';

export interface ProfileFirestoreCollections {
  profileCollection: ProfileFirestoreCollection;
  profilePrivateCollectionFactory: ProfilePrivateFirestoreCollectionFactory;
  profilePrivateCollectionGroup: ProfilePrivateFirestoreCollectionGroup;
}

export type ProfileTypes = typeof profileIdentity | typeof profilePrivateIdentity;

// MARK: Profile
export const profileIdentity = firestoreModelIdentity('profile', 'pr');

/**
 * Where the user's resume sits in the upload -> check -> verdict lifecycle.
 *
 * The check is asynchronous — the upload initializer creates the StorageFile, a `send` subtask enqueues
 * the OpenRouter run, and a `retrieve` subtask writes the verdict back a sweep tick later — so there is
 * a stretch with a resume but no answer, which is its own state rather than an absent verdict.
 */
export enum ProfileResumeState {
  /**
   * No resume has been uploaded.
   */
  NONE = 0,
  /**
   * A resume was uploaded and its check is queued or in flight.
   */
  CHECKING = 1,
  /**
   * The check finished and wrote a verdict.
   */
  CHECKED = 2,
  /**
   * Every check attempt was spent without a verdict.
   */
  FAILED = 3
}

/**
 * The user's current resume and what the resume check concluded about it.
 *
 * Tracked on the Profile rather than read off the resume's StorageFile because the profile view already
 * streams this document, and — unlike a StorageFile — `firestore.rules` grants its owner read access.
 *
 * Replaced wholesale by each upload, so a new resume can never be shown carrying the previous one's
 * verdict.
 *
 * @dbxModelSubObject
 */
export interface ProfileResume {
  /**
   * The current state of the resume check.
   */
  state: ProfileResumeState;
  /**
   * The StorageFile the resume was copied to.
   */
  storageFile?: Maybe<StorageFileKey>;
  /**
   * When the upload was initialized.
   */
  uploadedAt?: Maybe<Date>;
  /**
   * When the verdict was written, if it has been.
   */
  checkedAt?: Maybe<Date>;
  /**
   * The model's verdict, if it answered.
   */
  isResume?: Maybe<boolean>;
  /**
   * The model's reasoning for the verdict.
   */
  reason?: Maybe<string>;
}

/**
 * A user's public-facing profile, keyed by their uid.
 *
 * @dbxModel
 * @dbxModelRead owner
 */
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
   * The user's resume and the resume check's verdict on it.
   *
   * Written by the resume upload initializer, then advanced by the `retrieve` subtask.
   */
  resume: ProfileResume;
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
    resume: firestoreSubObject<ProfileResume>({
      objectField: {
        fields: {
          state: firestoreEnum<ProfileResumeState>({ default: ProfileResumeState.NONE }),
          storageFile: optionalFirestoreString(),
          uploadedAt: optionalFirestoreDate(),
          checkedAt: optionalFirestoreDate(),
          isResume: optionalFirestoreBoolean(),
          reason: optionalFirestoreString()
        }
      }
    }),
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

// MARK: Profile Private
export const profilePrivateIdentity = firestoreModelIdentity(profileIdentity, 'profilePrivate', 'prp');

/**
 * Private, server-managed half of a {@link Profile}.
 *
 * The name must stay `capitalize(modelType)` — that is how the api-manifest
 * generator resolves a model's interface, so renaming this out of step with the
 * `profilePrivate` modelType silently drops the model from the manifest, and
 * with it the `@dbxModelServerOnly` declaration below.
 *
 * @dbxModel
 * @dbxModelServerOnly
 */
export interface ProfilePrivate {
  /**
   * Date the username was set at.
   */
  usernameSetAt: Date;
  /**
   * Date the profile was created at.
   */
  createdAt: Date;
}

export type ProfilePrivateRoles = 'owner' | GrantedReadRole;

export class ProfilePrivateDocument extends AbstractFirestoreDocument<ProfilePrivate, ProfilePrivateDocument, typeof profilePrivateIdentity> {
  get modelIdentity() {
    return profilePrivateIdentity;
  }
}

export const profilePrivateConverter = snapshotConverterFunctions<ProfilePrivate>({
  fields: {
    usernameSetAt: firestoreDate({ saveDefaultAsNow: false }),
    createdAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

/**
 * Creates a factory function that returns the subcollection reference for
 * ProfilePrivate documents under a given Profile parent document.
 *
 * @param context - The FirestoreContext used to resolve the subcollection.
 * @returns Accepts a ProfileDocument and returns its ProfilePrivate subcollection reference.
 */
export function profilePrivateCollectionReferenceFactory(context: FirestoreContext): (profile: ProfileDocument) => CollectionReference<ProfilePrivate> {
  return (profile: ProfileDocument) => {
    return context.subcollection(profile.documentRef, profilePrivateIdentity.collectionName);
  };
}

export type ProfilePrivateFirestoreCollection = SingleItemFirestoreCollection<ProfilePrivate, Profile, ProfilePrivateDocument>;
export type ProfilePrivateFirestoreCollectionFactory = (parent: ProfileDocument) => ProfilePrivateFirestoreCollection;

/**
 * Creates a factory that produces ProfilePrivate single-item Firestore collection
 * accessors scoped to a specific parent Profile document.
 *
 * @param firestoreContext - The FirestoreContext used to build the subcollection.
 * @returns A factory function that accepts a ProfileDocument parent and returns its ProfilePrivate collection.
 */
export function profilePrivateFirestoreCollectionFactory(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionFactory {
  const factory = profilePrivateCollectionReferenceFactory(firestoreContext);

  return (parent: ProfileDocument) => {
    return firestoreContext.singleItemFirestoreCollection({
      modelIdentity: profilePrivateIdentity,
      converter: profilePrivateConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new ProfilePrivateDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

/**
 * Returns the collection group reference for all ProfilePrivate documents
 * across every parent Profile, enabling cross-profile queries.
 *
 * @param context - The FirestoreContext used to resolve the collection group.
 * @returns A CollectionGroup reference for ProfilePrivate documents.
 */
export function profilePrivateCollectionReference(context: FirestoreContext): CollectionGroup<ProfilePrivate> {
  return context.collectionGroup(profilePrivateIdentity.collectionName);
}

export type ProfilePrivateFirestoreCollectionGroup = FirestoreCollectionGroup<ProfilePrivate, ProfilePrivateDocument>;

/**
 * Creates the Firestore collection group accessor for ProfilePrivate documents,
 * allowing queries across all profile private data subcollections.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection group.
 * @returns A ProfilePrivateFirestoreCollectionGroup for cross-parent profile private data queries.
 */
export function profilePrivateFirestoreCollectionGroup(firestoreContext: FirestoreContext): ProfilePrivateFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: profilePrivateIdentity,
    converter: profilePrivateConverter,
    queryLike: profilePrivateCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ProfilePrivateDocument(accessor, documentAccessor),
    firestoreContext
  });
}
