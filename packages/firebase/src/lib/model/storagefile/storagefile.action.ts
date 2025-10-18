import { type AsyncFirebaseFunctionDeleteAction, type FirebaseFunctionDeleteAction, type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type StorageFileDocument } from './storagefile';

export type StorageFileCreateAction<P extends object> = FirebaseFunctionCreateAction<P, StorageFileDocument>;
export type AsyncStorageFileCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, StorageFileDocument>;

export type StorageFileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, StorageFileDocument>;
export type AsyncStorageFileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, StorageFileDocument>;

export type StorageFileDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, StorageFileDocument>;
export type AsyncStorageFileDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, StorageFileDocument>;
