import { type Maybe } from '@dereekb/util';
import { StorageFileCreationType, type StorageFileGroup, storageFileGroupCreatedStorageFileKey, StorageFileProcessingState, StorageFileState, type StorageFile, type StorageFileDocument, type StorageFileFirestoreCollections } from './storagefile';
import { type Transaction } from '../../common/firestore/types';
import { type FirestoreDocumentAccessor } from '../../common/firestore/accessor/document';
import { type FirebaseStorageAccessorFile } from '../../common/storage/driver/accessor';
import { type StoragePathRef, type StoragePath } from '../../common/storage/storage';
import { type FirebaseAuthOwnershipKey, type FirebaseAuthUserId } from '../../common/auth/auth';
import { EMPTY_STORAGE_FILE_PURPOSE_SUBGROUP, type StorageFilePurposeSubgroup, type StorageFileGroupId, type StorageFileGroupRelatedStorageFilePurpose, type StorageFileMetadata, type StorageFilePurpose } from './storagefile.id';
import { firestoreModelId, type ReadFirestoreModelKeyInput } from '../../common';

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
   * The display name of the StorageFile.
   *
   * Corresponds with the "n" value in the StorageFile template.
   */
  readonly displayName?: Maybe<string>;
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
   * The group ids of the file.
   *
   * Corresponds with the "g" value in the StorageFile template.
   */
  readonly storageFileGroupIds?: Maybe<StorageFileGroupId[]>;
  /**
   * If true, will flag the file for group sync.
   *
   * Defaults to true if one or more values in "storageFileGroupIds" are provided.
   *
   * Ignored if the "storageFileGroupIds" value is empty.
   */
  readonly flagForStorageFileGroupsSync?: boolean;
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
  readonly purpose?: Maybe<StorageFilePurpose | StorageFileGroupRelatedStorageFilePurpose>;
  /**
   * The subgroup of the purpose.
   *
   * Corresponds with the "pg" value in the StorageFile template.
   */
  readonly purposeSubgroup?: Maybe<StorageFilePurposeSubgroup>;
  /**
   * The StorageFileGroup that the file is associated with.
   *
   * This is ONLY used if the creation type is StorageFileCreationType.FOR_STORAGE_FILE_GROUP.
   */
  readonly parentStorageFileGroup?: Maybe<ReadFirestoreModelKeyInput<StorageFileGroup>>;
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
   * The default value for purposeSubgroup.
   *
   * If true, defaults to EMPTY_STORAGE_FILE_PURPOSE_SUBGROUP.
   */
  readonly defaultPurposeSubgroup?: Maybe<StorageFilePurposeSubgroup | true>;
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
  const { defaultCreationType: inputDefaultCreationType, defaultShouldBeProcessed: inputDefaultShouldBeProcessed, defaultPurposeSubgroup: inputDefaultPurposeSubgroup } = config;
  const defaultCreationType = inputDefaultCreationType ?? StorageFileCreationType.DIRECTLY_CREATED;
  const defaultShouldBeProcessed = inputDefaultShouldBeProcessed ?? false;
  const defaultPurposeSubgroup = inputDefaultPurposeSubgroup != null ? (inputDefaultPurposeSubgroup === true ? EMPTY_STORAGE_FILE_PURPOSE_SUBGROUP : inputDefaultPurposeSubgroup) : undefined;

  return async <M extends StorageFileMetadata = StorageFileMetadata>(input: CreateStorageFileDocumentPairInput<M>) => {
    const { template: inputTemplate, accessor: inputAccessor, transaction, context, now: inputNow, displayName, uploadedBy, user, purpose, purposeSubgroup, metadata, shouldBeProcessed, parentStorageFileGroup, storageFileGroupIds, flagForStorageFileGroupsSync } = input;
    const now = inputNow ?? new Date();

    let accessor = inputAccessor;

    if (!accessor && context) {
      const { storageFileCollection } = context;
      accessor = storageFileCollection.documentAccessorForTransaction(transaction);
    }

    if (!accessor) {
      throw new Error('createStorageFileDocumentPair() failed as neither an accessor nor a context was provided.');
    }

    const storagePath: Maybe<StoragePath> = input.file?.storagePath ?? input.storagePathRef?.storagePath ?? input.storagePath;

    if (!storagePath) {
      throw new Error('createStorageFileDocumentPair() failed as neither a file, storagePathRef, or storagePath was provided.');
    }

    let storageFileDocument;

    const p = purpose ?? inputTemplate?.p;
    const pg = purposeSubgroup ?? inputTemplate?.pg ?? (p != null ? defaultPurposeSubgroup : undefined);
    const ct = inputTemplate?.ct ?? defaultCreationType;

    if (ct === StorageFileCreationType.FOR_STORAGE_FILE_GROUP) {
      if (!parentStorageFileGroup || !p) {
        throw new Error('createStorageFileDocumentPair() failed as either the "parentStorageFileGroup" or "purpose" value was not provided with StorageFileCreationType.FOR_STORAGE_FILE_GROUP creation type.');
      }

      const storageFileGroupId = firestoreModelId(parentStorageFileGroup);
      const storageFileKey = storageFileGroupCreatedStorageFileKey(p, storageFileGroupId);

      storageFileDocument = accessor.loadDocumentForKey(storageFileKey);
    } else {
      storageFileDocument = accessor.newDocument();
    }

    const g = storageFileGroupIds ?? [];
    const gs = g.length > 0 && flagForStorageFileGroupsSync !== false;

    const template: StorageFile<M> = {
      ...inputTemplate,
      n: displayName ?? inputTemplate?.n,
      g,
      gs,
      cat: now,
      u: user ?? inputTemplate?.u,
      uby: uploadedBy ?? inputTemplate?.uby,
      p,
      pg,
      d: metadata ?? inputTemplate?.d,
      fs: inputTemplate?.fs ?? StorageFileState.OK,
      ps: (shouldBeProcessed ?? defaultShouldBeProcessed) ? StorageFileProcessingState.QUEUED_FOR_PROCESSING : StorageFileProcessingState.DO_NOT_PROCESS,
      ct,
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
