import { type FlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey, type FirestoreModelId, type FirestoreModelKey } from '../../common';

// MARK: StorageFile
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
 * A StorageFilePurpose that is related to a StorageFileGroup.
 *
 * Should only have the characters characters "a-z", "0-9", and/or "_", as it is used as part of a FirestoreModelId for StorageFileGroupCreatedStorageFileKey.
 */
export type StorageFileGroupRelatedStorageFilePurpose = StorageFilePurpose;

/**
 * Arbitrary metadata to attach to the storage file.
 *
 * Is serialized directly to/from Firestore, so be mindful of what is stored.
 */
export type StorageFileMetadata = Readonly<Record<string, any>>;

// MARK: StorageFileGroup
/**
 * The StorgaeFileGroupId is a two way flat firestore model key of the object that it represents.
 *
 * This identifier is used by StorageFile's to group files together based around some other model or common identifier.
 */
export type StorageFileGroupId = FlatFirestoreModelKey;
export type StorageFileGroupKey = FirestoreModelKey;

/**
 * Creates a StorgaeFileGroupId from the input FirestoreModelKey.
 *
 * @param modelKey
 * @returns
 */
export const storageFileGroupIdForModel = twoWayFlatFirestoreModelKey;
export const inferStorageFileGroupRelatedModelKey = inferKeyFromTwoWayFlatFirestoreModelKey;
