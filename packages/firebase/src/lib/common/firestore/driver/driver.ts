import { type FirestoreAccessorDriverRef } from './accessor';
import { type FirestoreQueryDriverRef } from './query';

/**
 * Optional human-readable identifier for the Firestore driver (e.g., 'firebase-admin', 'firebase-web', 'testing').
 */
export type FirestoreDriverIdentifier = string;

/**
 * Indicates whether the driver targets a real Firestore instance or a test environment.
 *
 * Used to conditionally enable behaviors like path fuzzing in tests, or to gate
 * production-only optimizations.
 */
export type FirestoreDriverType = 'production' | 'testing';

/**
 * Combined driver interface that provides all Firestore operational capabilities.
 *
 * This is the top-level driver abstraction that platform-specific implementations
 * (e.g., Firebase Web SDK, Firebase Admin SDK, or test mocks) must satisfy.
 * It is consumed by {@link FirestoreContext} to wire up collection factories, query
 * execution, batch writes, and transactions in a platform-agnostic way.
 *
 * @see {@link FirestoreAccessorDriver} for document/collection CRUD operations
 * @see {@link FirestoreQueryDriver} for query execution operations
 */
export interface FirestoreDrivers extends FirestoreQueryDriverRef, FirestoreAccessorDriverRef {
  firestoreDriverIdentifier?: FirestoreDriverIdentifier;
  firestoreDriverType: FirestoreDriverType;
}
