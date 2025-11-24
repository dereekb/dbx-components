import { type AsyncFirebaseFunctionDeleteAction, type FirebaseFunctionDeleteAction, type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionUpdateAction } from '../../common';
import { StorageFileGroupDocument, type StorageFileDocument } from './storagefile';

export type StorageFileCreateAction<P extends object> = FirebaseFunctionCreateAction<P, StorageFileDocument>;
export type AsyncStorageFileCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, StorageFileDocument>;

export type StorageFileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, StorageFileDocument>;
export type AsyncStorageFileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, StorageFileDocument>;

export type StorageFileDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, StorageFileDocument>;
export type AsyncStorageFileDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, StorageFileDocument>;

export type StorageFileGroupCreateAction<P extends object> = FirebaseFunctionCreateAction<P, StorageFileGroupDocument>;
export type AsyncStorageFileGroupCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, StorageFileGroupDocument>;

export type StorageFileGroupUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, StorageFileGroupDocument>;
export type AsyncStorageFileGroupUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, StorageFileGroupDocument>;

export type StorageFileGroupDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, StorageFileGroupDocument>;
export type AsyncStorageFileGroupDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, StorageFileGroupDocument>;
