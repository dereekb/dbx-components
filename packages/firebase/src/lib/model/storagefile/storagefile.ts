import { type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, firestoreDate, firestoreModelIdentity, snapshotConverterFunctions, FirebaseAuthUserId, FirebaseAuthOwnershipKey, optionalFirestoreString, firestorePassThroughField, StoragePath, firestoreString, firestoreEnum, optionalFirestoreDate } from '../../common';
import { StorageFileMetadata, StorageFilePurpose } from './storagefile.id';

export abstract class StorageFileFirestoreCollections {
  abstract readonly storageFileCollection: StorageFileFirestoreCollection;
}

export type StorageFileTypes = typeof storageFileIdentity;

// MARK: StorageFile
export const storageFileIdentity = firestoreModelIdentity('storageFile', 'sf');

/**
 * The current file state.
 */
export enum StorageFileState {
  /**
   * The StorageFile has no state, or is just being initialized.
   */
  INIT = 0,
  /**
   * The StorageFile failed to initialize properly, and is considered invalid.
   *
   * StorageFiles that are marked invalid are deleted after a period of time.
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
   * The StorageFile has no state, or is just being initialized.
   */
  INIT = 0,
  /**
   * The StorageFile has been queued for processing.
   */
  QUEUED = 1,
  /**
   * The StorageFile is currently being processed.
   */
  PROCESSING = 2,
  /**
   * The StorageFile has encountered an error during processing.
   */
  FAILED = 3,
  /**
   * The StorageFile has been processed or required no processing and is done.
   */
  SUCCESS = 4
}

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
   * State of the storage file.
   */
  fs: StorageFileState;
  /**
   * Processing state of the storage file.
   */
  ps: StorageFileProcessingState;
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
   * Arbitrary metadata attached to the storage file.
   */
  d?: M;
  /**
   * Scheduled delete at date.
   *
   * If set, then the status should be QUEUED_FOR_DELETE.
   */
  sdat?: Maybe<Date>;
}

export type StorageFileRoles = GrantedUpdateRole | GrantedReadRole;

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
    fs: firestoreEnum<StorageFileState>({ default: StorageFileState.INIT }),
    ps: firestoreEnum<StorageFileProcessingState>({ default: StorageFileProcessingState.INIT }),
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
