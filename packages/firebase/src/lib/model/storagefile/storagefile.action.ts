import { type AsyncFirebaseFunctionDeleteAction, type FirebaseFunctionDeleteAction, type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type StorageFileGroupDocument, type StorageFileDocument } from './storagefile';

/**
 * @module storagefile.action
 *
 * Type aliases for StorageFile and StorageFileGroup server action functions.
 *
 * These connect API parameter types to their target document types, following the same
 * pattern as notification actions. See `@dereekb/firebase-server/model` for the
 * server-side action service implementations.
 *
 * @template P - the API parameter type for the action
 */

// MARK: StorageFile Actions
/**
 * Synchronous create action targeting a {@link StorageFileDocument}.
 */
export type StorageFileCreateAction<P extends object> = FirebaseFunctionCreateAction<P, StorageFileDocument>;

/**
 * Async create action targeting a {@link StorageFileDocument}.
 */
export type AsyncStorageFileCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, StorageFileDocument>;

/**
 * Synchronous update action targeting a {@link StorageFileDocument}.
 */
export type StorageFileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, StorageFileDocument>;

/**
 * Async update action targeting a {@link StorageFileDocument}.
 */
export type AsyncStorageFileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, StorageFileDocument>;

/**
 * Synchronous delete action targeting a {@link StorageFileDocument}.
 */
export type StorageFileDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, StorageFileDocument>;

/**
 * Async delete action targeting a {@link StorageFileDocument}.
 */
export type AsyncStorageFileDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, StorageFileDocument>;

// MARK: StorageFileGroup Actions
/**
 * Synchronous create action targeting a {@link StorageFileGroupDocument}.
 */
export type StorageFileGroupCreateAction<P extends object> = FirebaseFunctionCreateAction<P, StorageFileGroupDocument>;

/**
 * Async create action targeting a {@link StorageFileGroupDocument}.
 */
export type AsyncStorageFileGroupCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, StorageFileGroupDocument>;

/**
 * Synchronous update action targeting a {@link StorageFileGroupDocument}.
 */
export type StorageFileGroupUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, StorageFileGroupDocument>;

/**
 * Async update action targeting a {@link StorageFileGroupDocument}.
 */
export type AsyncStorageFileGroupUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, StorageFileGroupDocument>;

/**
 * Synchronous delete action targeting a {@link StorageFileGroupDocument}.
 */
export type StorageFileGroupDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, StorageFileGroupDocument>;

/**
 * Async delete action targeting a {@link StorageFileGroupDocument}.
 */
export type AsyncStorageFileGroupDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, StorageFileGroupDocument>;
