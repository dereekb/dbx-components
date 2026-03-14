import { type Factory } from '@dereekb/util';
import { type Firestore, type WriteBatch } from '../types';

/**
 * Creates a new {@link WriteBatch} for atomically committing multiple write operations.
 */
export type WriteBatchFactory = Factory<WriteBatch>;

/**
 * Creates a {@link WriteBatchFactory} bound to the given Firestore instance.
 * Used by the driver layer to provide batch writing capabilities per-Firestore.
 */
export type WriteBatchForFirestoreFactory = (firestore: Firestore) => WriteBatchFactory;

/**
 * Holds a reference to a {@link WriteBatchFactory} for creating write batches.
 */
export interface WriteBatchFactoryReference {
  readonly batch: WriteBatchFactory;
}

/**
 * Driver component that provides {@link WriteBatch} creation for a Firestore instance.
 * Implemented by platform-specific drivers (Web SDK, Admin SDK).
 */
export interface FirestoreWriteBatchFactoryDriver {
  readonly writeBatchFactoryForFirestore: WriteBatchForFirestoreFactory;
}
