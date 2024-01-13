import { type WriteBatch } from '../types';
import { type FirestoreDocumentContext, type FirestoreDocumentContextType } from './context';

export type WriteBatchFirestoreDocumentContextFactory = <T>(writeBatch: WriteBatch) => WriteBatchFirestoreDocumentContext<T>;

export interface WriteBatchFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  readonly contextType: FirestoreDocumentContextType.BATCH;
  readonly batch: WriteBatch;
}
