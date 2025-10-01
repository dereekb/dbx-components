import { type Maybe } from '@dereekb/util';
import { StorageFileCreationType, StorageFileProcessingState, StorageFileState, type StorageFile, type StorageFileDocument, type StorageFileFirestoreCollections } from './storagefile';
import { type Transaction } from '../../common/firestore/types';
import { type FirestoreDocumentAccessor } from '../../common/firestore/accessor/document';
import { type FirebaseStorageAccessorFile } from '../../common/storage/driver/accessor';
import { StoragePathRef, type StoragePath } from '../../common/storage/storage';
import { FirebaseAuthOwnershipKey, type FirebaseAuthUserId } from '../../common/auth/auth';
import { StorageFileMetadata, StorageFilePurpose } from './storagefile.id';

// MARK: Create Document
export interface CreateStorageFileDocumentPairInput<M extends StorageFileMetadata = StorageFileMetadata> {
  /**
   * Optional "now" value that is assigned to the "cat" value, created at time.
   */
  readonly now?: Maybe<Date>;
  /**
   * The document transaction
   */
  readonly transaction?: Transaction;
  /**
   * The storage path to set on the StorageFile template.
   *
   * Is ignored if file or storagePathRef is provided.
   */
  readonly storagePath?: StoragePath;
  /**
   * The ref of the storage path to set on the StorageFile template.
   *
   * Is ignored if file is provided.
   */
  readonly storagePathRef?: StoragePathRef;
  /**
   * File to use when creating the StorageFile.
   */
  readonly file?: FirebaseStorageAccessorFile;
  /**
   * The user that the file is associated with.
   *
   * Corresponds with the "u" value in the StorageFile template.
   */
  readonly user?: Maybe<FirebaseAuthUserId>;
  /**
   * The user that uploaded the file.
   *
   * Corresponds with the "uby" value in the StorageFile template.
   */
  readonly uploadedBy?: Maybe<FirebaseAuthUserId>;
  /**
   * The ownership key of the file.
   *
   * Corresponds with the "o" value in the StorageFile template.
   */
  readonly ownershipKey?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * The purpose of the file.
   *
   * Corresponds with the "p" value in the StorageFile template.
   */
  readonly purpose?: Maybe<StorageFilePurpose>;
  /**
   * The metadata of the file.
   *
   * Corresponds with the "m" value in the StorageFile template.
   */
  readonly metadata?: Maybe<M>;
  /**
   * If true, will queue the StorageFile for processing.
   */
  readonly shouldBeProcessed?: Maybe<boolean>;
  /**
   * Template details for the StorageFileDocument.
   */
  readonly template?: Maybe<Omit<Partial<StorageFile<M>>, 'cat'>>;
  /**
   * Context to create the accessor from.
   */
  readonly context?: Pick<StorageFileFirestoreCollections, 'storageFileCollection'>;
  /**
   * Accessor to use directly.
   */
  readonly accessor?: FirestoreDocumentAccessor<StorageFile, StorageFileDocument>;
}

export interface CreateStorageFileDocumentPairResult<M extends StorageFileMetadata = StorageFileMetadata> {
  /**
   * The StorageFileDocument that was created.
   */
  readonly storageFileDocument: StorageFileDocument;
  /**
   * The template that was passed to create the StorageFileDocument.
   */
  readonly storageFile: StorageFile<M>;
}

export interface CreateStorageFileDocumentPairFactoryConfig {
  /**
   * The default creation type to use.
   *
   * Defaults to StorageFileCreationType.DIRECTLY_CREATED.
   */
  readonly defaultCreationType?: Maybe<StorageFileCreationType>;
  /**
   * The default value for shouldBeProcessed.
   *
   * Defaults to false.
   */
  readonly defaultShouldBeProcessed?: Maybe<boolean>;
}

/**
 * Factory function for creating StorageFileDocument pairs.
 */
export type CreateStorageFileDocumentPairFactory = <M extends StorageFileMetadata = StorageFileMetadata>(input: CreateStorageFileDocumentPairInput<M>) => Promise<CreateStorageFileDocumentPairResult<M>>;

/**
 * Creates a CreateStorageFileDocumentPairFactory.
 *
 * @param config
 * @returns
 */
export function createStorageFileDocumentPairFactory(config: CreateStorageFileDocumentPairFactoryConfig = {}): CreateStorageFileDocumentPairFactory {
  const { defaultCreationType: inputDefaultCreationType, defaultShouldBeProcessed: inputDefaultShouldBeProcessed } = config;
  const defaultCreationType = inputDefaultCreationType ?? StorageFileCreationType.DIRECTLY_CREATED;
  const defaultShouldBeProcessed = inputDefaultShouldBeProcessed ?? false;

  return async <M extends StorageFileMetadata = StorageFileMetadata>(input: CreateStorageFileDocumentPairInput<M>) => {
    const { template: inputTemplate, accessor: inputAccessor, transaction, context, now: inputNow, uploadedBy, user, purpose, metadata, shouldBeProcessed } = input;
    const now = inputNow ?? new Date();

    let accessor = inputAccessor;

    if (!accessor && context) {
      const { storageFileCollection } = context;
      accessor = storageFileCollection.documentAccessorForTransaction(transaction);
    }

    if (!accessor) {
      throw new Error('createStorageFileDocumentPair() failed as neither an accessor nor a context was provided.');
    }

    let storagePath: Maybe<StoragePath> = input.file?.storagePath ?? input.storagePathRef?.storagePath ?? input.storagePath;

    if (!storagePath) {
      throw new Error('createStorageFileDocumentPair() failed as neither a file, storagePathRef, or storagePath was provided.');
    }

    let storageFileDocument = accessor.newDocument();

    const template: StorageFile<M> = {
      ...inputTemplate,
      cat: now,
      u: user ?? inputTemplate?.u,
      uby: uploadedBy ?? inputTemplate?.uby,
      p: purpose ?? inputTemplate?.p,
      d: metadata ?? inputTemplate?.d,
      fs: inputTemplate?.fs ?? StorageFileState.OK,
      ps: (shouldBeProcessed ?? defaultShouldBeProcessed) ? StorageFileProcessingState.QUEUED_FOR_PROCESSING : StorageFileProcessingState.DO_NOT_PROCESS,
      ct: inputTemplate?.ct ?? defaultCreationType,
      bucketId: storagePath.bucketId,
      pathString: storagePath.pathString
    };

    // create the StorageFileDocument
    await storageFileDocument.create(template);

    return {
      storageFileDocument,
      storageFile: template
    };
  };
}

/**
 * Convenience function for creating a StorageFileDocumentPair.
 *
 * Calls createStorageFileDocumentPairFactory() with no arguments, then passes the input to the factory and returns the result.
 */
export async function createStorageFileDocumentPair<M extends StorageFileMetadata = StorageFileMetadata>(input: CreateStorageFileDocumentPairInput<M>): Promise<CreateStorageFileDocumentPairResult<M>> {
  return createStorageFileDocumentPairFactory()(input);
}
