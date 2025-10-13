import { MS_IN_HOUR, type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, firestoreDate, firestoreModelIdentity, snapshotConverterFunctions, FirebaseAuthUserId, FirebaseAuthOwnershipKey, optionalFirestoreString, firestorePassThroughField, StoragePath, firestoreString, firestoreEnum, optionalFirestoreDate, optionalFirestoreEnum } from '../../common';
import { StorageFileMetadata, StorageFilePurpose } from './storagefile.id';
import { NotificationKey } from '../notification';

export abstract class StorageFileFirestoreCollections {
  abstract readonly storageFileCollection: StorageFileFirestoreCollection;
}

export type StorageFileTypes = typeof storageFileIdentity;

// MARK: StorageFile
export const storageFileIdentity = firestoreModelIdentity('storageFile', 'sf');

/**
 * The current file state.
 */
export enum StorageFileCreationType {
  /**
   * No info about how this file was created.
   */
  NONE = 0,
  /**
   * The StorageFile was directly created.
   */
  DIRECTLY_CREATED = 1,
  /**
   * The StorageFile was initialized from an uploaded file.
   */
  INIT_FROM_UPLOAD = 2
}

/**
 * The current file state.
 */
export enum StorageFileState {
  /**
   * The StorageFile has no state, or is just being initialized.
   */
  INIT = 0,
  /**
   * The StorageFile failed to initialize properly and is considered invalid.
   *
   * StorageFiles that are marked invalid are deleted after a period of time.
   *
   * Files that are invalid cannot be processed.
   */
  INVALID = 1,
  /**
   * The StorageFile has been initialized and is ok.
   */
  OK = 2,
  /**
   * A previously OK file that is now queued for deletion.
   */
  QUEUED_FOR_DELETE = 3
}

/**
 * The current processing state of the file.
 */
export enum StorageFileProcessingState {
  /**
   * The StorageFile has no processing state or is just being initialized.
   */
  INIT_OR_NONE = 0,
  /**
   * The StorageFile is flagged for processing, which will create a NotificationTask for it.
   */
  QUEUED_FOR_PROCESSING = 1,
  /**
   * The StorageFile has an associated NotificationTask for it.
   */
  PROCESSING = 2,
  /**
   * The StorageFile has encountered an error during processing.
   */
  FAILED = 3,
  /**
   * The StorageFile has been processed or required no processing and is done.
   */
  SUCCESS = 4,
  /**
   * The StorageFile has been archived. It should not be processed.
   */
  ARCHIVED = 5,
  /**
   * The StorageFile shouldn't be processed.
   */
  DO_NOT_PROCESS = 6
}

/**
 * After 3 hours of being in the PROCESSING state, we can check for retring processing.
 */
export const STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS = MS_IN_HOUR * 3;

/**
 * A global storage file in the system.
 *
 * Contains file metadata and ownership information, along with other arbitrary metadata.
 */
export interface StorageFile<M extends StorageFileMetadata = StorageFileMetadata> extends StoragePath {
  /**
   * Created at date
   */
  cat: Date;
  /**
   * Type of creation.
   */
  ct?: Maybe<StorageFileCreationType>;
  /**
   * State of the storage file.
   */
  fs: StorageFileState;
  /**
   * Processing state of the storage file.
   */
  ps: StorageFileProcessingState;
  /**
   * The NotificationTask key for this storage file.
   *
   * Set only if the StorageFile has an associated NotificationTask.
   *
   * Cleared once the processing stage is no longer PROCESSING.
   */
  pn?: Maybe<NotificationKey>;
  /**
   * The date that state was last updated to PROCESSING.
   *
   * Is used as a way to track if processing should be checked on.
   */
  pat?: Maybe<Date>;
  /**
   * The date that the cleanup step of the processing task was run, and the notification ended.
   */
  pcat?: Maybe<Date>;
  /**
   * User this file is associated with, if applicable.
   */
  u?: Maybe<FirebaseAuthUserId>;
  /**
   * User who uploaded this file, if applicable.
   */
  uby?: Maybe<FirebaseAuthUserId>;
  /**
   * Ownership key, if applicable.
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * Purpose of the file, if applicable.
   */
  p?: Maybe<StorageFilePurpose>;
  /**
   * Arbitrary metadata attached to the StorageFile.
   */
  d?: Maybe<M>;
  /**
   * Scheduled delete at date. The StorageFile cannot be deleted before this set time.
   *
   * Is the main trigger for determining a StorageFile should be deleted.
   */
  sdat?: Maybe<Date>;
}

export type StorageFileRoles = 'process' | GrantedUpdateRole | GrantedReadRole;

export class StorageFileDocument extends AbstractFirestoreDocument<StorageFile, StorageFileDocument, typeof storageFileIdentity> {
  get modelIdentity() {
    return storageFileIdentity;
  }
}

export const storageFileConverter = snapshotConverterFunctions<StorageFile>({
  fields: {
    bucketId: firestoreString(),
    pathString: firestoreString(),
    cat: firestoreDate(),
    ct: optionalFirestoreEnum<StorageFileCreationType>({ defaultReadValue: StorageFileCreationType.NONE, dontStoreDefaultReadValue: true }),
    fs: firestoreEnum<StorageFileState>({ default: StorageFileState.INIT }),
    ps: firestoreEnum<StorageFileProcessingState>({ default: StorageFileProcessingState.INIT_OR_NONE }),
    pn: optionalFirestoreString(),
    pat: optionalFirestoreDate(),
    pcat: optionalFirestoreDate(),
    u: optionalFirestoreString(),
    uby: optionalFirestoreString(),
    o: optionalFirestoreString(),
    p: optionalFirestoreString(),
    d: firestorePassThroughField(),
    sdat: optionalFirestoreDate()
  }
});

export function storageFileCollectionReference(context: FirestoreContext): CollectionReference<StorageFile> {
  return context.collection(storageFileIdentity.collectionName);
}

export type StorageFileFirestoreCollection = FirestoreCollection<StorageFile, StorageFileDocument>;

export function storageFileFirestoreCollection(firestoreContext: FirestoreContext): StorageFileFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: storageFileIdentity,
    converter: storageFileConverter,
    collection: storageFileCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new StorageFileDocument(accessor, documentAccessor),
    firestoreContext
  });
}
