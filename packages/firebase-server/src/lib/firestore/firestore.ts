import { type FirestoreContextFactory, firestoreContextFactory } from '@dereekb/firebase';
import { googleCloudFirestoreDrivers } from './driver';

/**
 * Pre-configured {@link FirestoreContextFactory} for Google Cloud Firestore (Admin SDK) usage.
 *
 * Wires the server-side Firestore drivers into the abstract {@link FirestoreContextFactory}
 * so that collections, documents, queries, and transactions all use the Admin SDK implementation.
 *
 * @example
 * ```ts
 * const context = googleCloudFirestoreContextFactory(firestore);
 * ```
 */
export const googleCloudFirestoreContextFactory: FirestoreContextFactory = firestoreContextFactory(googleCloudFirestoreDrivers());
