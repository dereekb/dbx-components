import { type FirestoreContextFactory, firestoreContextFactory } from '../../common/firestore/context';
import { firebaseFirestoreClientDrivers } from './driver';

/**
 * Pre-configured {@link FirestoreContextFactory} for client-side (browser) Firebase usage.
 *
 * Wires the client Firestore drivers (from the `firebase/firestore` SDK) into the abstract
 * {@link FirestoreContextFactory} so that collections, documents, queries, and transactions
 * all use the client-side Firestore implementation.
 *
 * @example
 * ```ts
 * // Without caching
 * const context = clientFirebaseFirestoreContextFactory(firestore);
 *
 * // With caching
 * const context = clientFirebaseFirestoreContextFactory(firestore, {
 *   firestoreContextCacheFactory: inMemoryFirestoreContextCacheFactory()
 * });
 * ```
 */
export const clientFirebaseFirestoreContextFactory: FirestoreContextFactory = firestoreContextFactory(firebaseFirestoreClientDrivers());
