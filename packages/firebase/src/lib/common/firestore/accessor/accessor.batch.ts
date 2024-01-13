import { type WriteBatch } from '../types';
import { type FirestoreDocumentDataAccessorFactory } from './accessor';

export type WriteBatchAccessorFactory = <T>(writeBatch: WriteBatch) => FirestoreDocumentDataAccessorFactory<T>;
