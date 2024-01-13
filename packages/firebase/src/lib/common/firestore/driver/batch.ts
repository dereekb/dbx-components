import { type Factory } from '@dereekb/util';
import { type Firestore, type WriteBatch } from '../types';

/**
 * Factory for a WriteBatch.
 */
export type WriteBatchFactory = Factory<WriteBatch>;

/**
 * Factory for making a WriteBatchFactory for the input Firestore.
 */
export type WriteBatchForFirestoreFactory = (firestore: Firestore) => WriteBatchFactory;

/**
 * Reference to a WriteBatchFactory.
 */
export interface WriteBatchFactoryReference {
  readonly batch: WriteBatchFactory;
}

/**
 * Driver for prividing a WriteBatchForFirestoreFactory
 */
export interface FirestoreWriteBatchFactoryDriver {
  readonly writeBatchFactoryForFirestore: WriteBatchForFirestoreFactory;
}
