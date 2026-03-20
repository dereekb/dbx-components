import { type SlashPathUntypedFile } from '@dereekb/util';
import { type FlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, twoWayFlatFirestoreModelKey, type FirestoreModelId, type FirestoreModelKey } from '../../common';

/**
 * @module storagefile.id
 *
 * Defines identity types and ID generation patterns for the StorageFile and StorageFileGroup models.
 *
 * StorageFileGroup IDs use a two-way flat key encoding of the related model's key, enabling
 * bidirectional lookup between a group and its source model via {@link storageFileGroupIdForModel}
 * and {@link inferStorageFileGroupRelatedModelKey}.
 */

// MARK: StorageFile
/**
 * Firestore document ID for a StorageFile.
 */
export type StorageFileId = FirestoreModelId;

/**
 * Full Firestore document key (collection path + ID) for a StorageFile.
 */
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
 * Used as an arbitrary discriminator for a StorageFile in relation to the StorageFilePurpose.
 *
 * This is useful for being able to query StorageFiles that have a specific purpose and purpose subgroup.
 *
 * Example use case: Documents with the same StorageFilePurpose/processing, but should only have a single StorageFile per subgroup.
 */
export type StorageFilePurposeSubgroup = string;

/**
 * Arbitrary untyped name that is attached with a StorageFile.
 *
 * This is an alternate name for the file that can be used for display purposes. It
 * is used within StorageFileGroup's zip file as the primary name. The display name
 * is merged with the StorageFile's file path extension to create the file name.
 */
export type StorageFileDisplayName = SlashPathUntypedFile;

/**
 * A default constant to use as a default StorageFilePurposeSubgroup value for StorageFiles that have a purpose that defines subgroups.
 */
export const EMPTY_STORAGE_FILE_PURPOSE_SUBGROUP: StorageFilePurposeSubgroup = '';

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
 * A StorageFileGroup's document ID, encoded as a two-way flat Firestore model key
 * of the model it represents.
 *
 * This encoding enables bidirectional lookup: given a model key you can derive the
 * group ID, and given a group ID you can recover the original model key.
 *
 * @example
 * ```ts
 * const groupId = storageFileGroupIdForModel('notification/abc123');
 * // groupId is a flat key like "notification_abc123"
 *
 * const modelKey = inferStorageFileGroupRelatedModelKey(groupId);
 * // modelKey === 'notification/abc123'
 * ```
 */
export type StorageFileGroupId = FlatFirestoreModelKey;

/**
 * Full Firestore document key (collection path + ID) for a StorageFileGroup.
 */
export type StorageFileGroupKey = FirestoreModelKey;

/**
 * Encodes a FirestoreModelKey into a {@link StorageFileGroupId} using two-way flat key encoding.
 *
 * @example
 * ```ts
 * const groupId = storageFileGroupIdForModel('notification/abc123');
 * ```
 */
export const storageFileGroupIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Decodes a {@link StorageFileGroupId} back into the original FirestoreModelKey.
 *
 * @example
 * ```ts
 * const modelKey = inferStorageFileGroupRelatedModelKey(groupId);
 * ```
 */
export const inferStorageFileGroupRelatedModelKey = inferKeyFromTwoWayFlatFirestoreModelKey;
