import { type FirestoreModelId, type FirestoreModelKey } from '../../common';

export type StorageFileId = FirestoreModelId;
export type StorageFileKey = FirestoreModelKey;

/**
 * Arbitrary string that can be used to describe the file's purpose.
 *
 * It should be unique between different file types.
 *
 * The purpose is generally used while querying for StorageFiles that require processing, but can also be
 * set on files that do not get processed.
 *
 * Can be used for querying.
 */
export type StorageFilePurpose = string;

/**
 * Arbitrary metadata to attach to the storage file.
 *
 * Is serialized directly to/from Firestore, so be mindful of what is stored.
 */
export type StorageFileMetadata = Readonly<Record<string, any>>;
