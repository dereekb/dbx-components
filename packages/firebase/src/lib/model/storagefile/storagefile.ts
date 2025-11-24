import { MS_IN_HOUR, NeedsSyncBoolean, UnixDateTimeSecondsNumber, type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreContext,
  firestoreDate,
  firestoreModelIdentity,
  snapshotConverterFunctions,
  type FirebaseAuthUserId,
  type FirebaseAuthOwnershipKey,
  optionalFirestoreString,
  firestorePassThroughField,
  type StoragePath,
  firestoreString,
  firestoreEnum,
  optionalFirestoreDate,
  optionalFirestoreEnum,
  type StorageSignedDownloadUrl,
  type StorageDownloadUrl,
  firestoreUniqueStringArray,
  optionalFirestoreBoolean,
  SavedToFirestoreIfTrue,
  firestoreSubObject,
  firestoreNumber,
  firestoreUnixDateTimeSecondsNumber,
  optionalFirestoreUID,
  optionalFirestoreUnixDateTimeSecondsNumber,
  firestoreObjectArray
} from '../../common';
import { StorageFileGroupId, type StorageFileId, type StorageFileMetadata, type StorageFilePurpose } from './storagefile.id';
import { type NotificationKey } from '../notification';

export abstract class StorageFileFirestoreCollections {
  abstract readonly storageFileCollection: StorageFileFirestoreCollection;
  abstract readonly storageFileGroupCollection: StorageFileGroupFirestoreCollection;
}

export type StorageFileTypes = typeof storageFileIdentity | typeof storageFileGroupIdentity;

/**
 * StorageFile-related model that is initialized asynchronously at a later time.
 *
 * Examples: StorageFileGroup
 */
export interface InitializedStorageFileModel {
  /**
   * True if this model needs to be sync'd/initialized with the original model.
   *
   * Is set false if/when "fi" is set true.
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * True if this model has been flagged invalid.
   *
   * This is for cases where the model cannot be properly initiialized.
   *
   * Typically this results in this model and related data being deleted.
   */
  fi?: Maybe<SavedToFirestoreIfTrue>;
}

// MARK: StorageFile
export const storageFileIdentity = firestoreModelIdentity('storageFile', 'sf');

/**
 * This key is used in the CustomStorageMetadata of a Firebase Storage file that is associated with a StorageFile to link the file to the StorageFile.
 */
export const STORAGEFILE_RELATED_FILE_METADATA_KEY = '__sf__';

/**
 * CustomStorageMetadata interface that is assigned to files that are associated with a StorageFile.
 */
export interface StorageFileRelatedFileMetadata {
  /**
   * The StorageFile id that this file is associated with.
   */
  readonly [STORAGEFILE_RELATED_FILE_METADATA_KEY]?: Maybe<StorageFileId>;
}

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
   *
   * It can be queued for reprocessing.
   */
  FAILED = 3,
  /**
   * The StorageFile has been processed or required no processing and is done.
   *
   * It can be queued for reprocessing.
   */
  SUCCESS = 4,
  /**
   * The StorageFile has been archived.
   *
   * It cannot be queued for reprocessing.
   */
  ARCHIVED = 5,
  /**
   * The StorageFile shouldn't be processed.
   *
   * It cannot be queued for reprocessing.
   */
  DO_NOT_PROCESS = 6
}

/**
 * If true, the StorageFile can safely be re-queued for processing.
 *
 * Requirements:
 * - Has a purpose
 * - The processing state is not already queued for processing, or processing.
 * - The processing state is not archived or marked as do not process, as these should never be re-processed.
 *
 * @param state
 * @returns
 */
export function canQueueStorageFileForProcessing(storageFile: Pick<StorageFile, 'ps' | 'p'>): boolean {
  const { p: purpose, ps: state } = storageFile;
  return (Boolean(purpose) && state === StorageFileProcessingState.INIT_OR_NONE) || state === StorageFileProcessingState.FAILED || state === StorageFileProcessingState.SUCCESS;
}

/**
 * After 3 hours of being in the PROCESSING state, we can check for retring processing.
 */
export const STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS = MS_IN_HOUR * 3;

/**
 * A Google Cloud public download URL for a StorageFile.
 *
 * This URL is not protected by authentication and is the permanent URL for the file.
 *
 * Consider using a StorageFileSignedDownloadUrl if the file should be protected.
 */
export type StorageFilePublicDownloadUrl = StorageDownloadUrl;

/**
 * A Google Cloud signed download URL for a StorageFile.
 *
 * It expires after a period of time.
 */
export type StorageFileSignedDownloadUrl = StorageSignedDownloadUrl;

/**
 * A StorageFile in the system, which references a file in Google Cloud Storage.
 *
 * Contains file metadata and ownership information, along with other arbitrary metadata.
 */
export interface StorageFile<M extends StorageFileMetadata = StorageFileMetadata> extends StoragePath {
  /**
   * Created at date.
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
   *
   * The state is important for managing the processing of the StorageFile.
   *
   * Once processing is finished, the state determines whether or not the StorageFile can be processed again.
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
   *
   * Is required for processing a StorageFile.
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
  /**
   * StorageFileGroup id(s) that this StorageFile should be associated with.
   *
   * These StorageFileGroup do not need to exist, and will be created when synchronization occurs.
   */
  g: StorageFileGroupId[];
  /**
   * If true, this file should be re-synced with each StorageFileGroup(s) it references.
   */
  gs?: Maybe<NeedsSyncBoolean>;
}

/**
 * Granted roles for creating a download link to the StorageFile's file.
 *
 * The admin_download role allows specifying additional parameters and longer expiration times.
 */
export type StorageFileDownloadRole = 'download' | 'admin_download';

export type StorageFileRoles = StorageFileDownloadRole | 'process' | GrantedUpdateRole | GrantedReadRole;

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
    sdat: optionalFirestoreDate(),
    g: firestoreUniqueStringArray(),
    gs: optionalFirestoreBoolean()
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

// MARK: StorageFileGroup
export const storageFileGroupIdentity = firestoreModelIdentity('storageFileGroup', 'sfg');

/**
 * Current embedded state
 */
export interface StorageFileGroupEmbeddedFile {
  /**
   * StorageFile id
   */
  id: StorageFileId;
  /**
   * The time number it was added to the group.
   */
  sat: Date;
  /**
   * The last time the StorageFile's file was added to the zip, if applicable.
   */
  zat?: Maybe<Date>;
}

export const storageFileGroupEmbeddedFile = firestoreSubObject<StorageFileGroupEmbeddedFile>({
  objectField: {
    fields: {
      id: firestoreString(),
      sat: firestoreUnixDateTimeSecondsNumber({ default: new Date() }),
      zat: optionalFirestoreUnixDateTimeSecondsNumber()
    }
  }
});

/**
 * A group of StorageFiles.
 *
 * Contains file metadata and ownership information, along with other arbitrary metadata.
 */
export interface StorageFileGroup extends InitializedStorageFileModel {
  /**
   * List of embedded files in this group currently.
   */
  f: StorageFileGroupEmbeddedFile[];
  /**
   * True if a zip file should be generated for this group.
   */
  z?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * StorageFile that contains the zip file for this group.
   */
  zsf: Maybe<StorageFileId>;
  /**
   * The last date the zip file was regenerated for this group.
   */
  zat?: Maybe<Date>;
}

export class StorageFileGroupDocument extends AbstractFirestoreDocument<StorageFileGroup, StorageFileGroupDocument, typeof storageFileGroupIdentity> {
  get modelIdentity() {
    return storageFileGroupIdentity;
  }
}

export const storageFileGroupConverter = snapshotConverterFunctions<StorageFileGroup>({
  fields: {
    f: firestoreObjectArray({
      objectField: storageFileGroupEmbeddedFile
    }),
    z: optionalFirestoreBoolean({ dontStoreIf: false }),
    zsf: optionalFirestoreString(),
    zat: optionalFirestoreDate(),
    s: optionalFirestoreBoolean({ dontStoreIf: false }),
    fi: optionalFirestoreBoolean({ dontStoreIf: false })
  }
});

export function storageFileGroupCollectionReference(context: FirestoreContext): CollectionReference<StorageFileGroup> {
  return context.collection(storageFileGroupIdentity.collectionName);
}

export type StorageFileGroupFirestoreCollection = FirestoreCollection<StorageFileGroup, StorageFileGroupDocument>;

export function storageFileGroupFirestoreCollection(firestoreContext: FirestoreContext): StorageFileGroupFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: storageFileGroupIdentity,
    converter: storageFileGroupConverter,
    collection: storageFileGroupCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new StorageFileGroupDocument(accessor, documentAccessor),
    firestoreContext
  });
}
