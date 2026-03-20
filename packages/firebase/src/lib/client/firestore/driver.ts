import { type FirestoreDrivers } from '../../common/firestore/driver/driver';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firebaseFirestoreQueryDriver } from './driver.query';

/**
 * Client-side {@link FirestoreDrivers} using the `firebase/firestore` SDK.
 */
export type FirebaseFirestoreClientDrivers = FirestoreDrivers;

/**
 * Creates the client-side {@link FirestoreDrivers} that bind the abstract Firestore driver
 * interfaces to the `firebase/firestore` SDK (browser/client).
 *
 * Provides accessor drivers (default, batch, transaction) and query drivers for use
 * with {@link clientFirebaseFirestoreContextFactory}.
 *
 * @returns the client-side {@link FirebaseFirestoreClientDrivers} for the `firebase/firestore` SDK
 *
 * @example
 * ```ts
 * const drivers = firebaseFirestoreClientDrivers();
 * const contextFactory = firestoreContextFactory(drivers);
 * ```
 */
export function firebaseFirestoreClientDrivers(): FirebaseFirestoreClientDrivers {
  return {
    firestoreDriverIdentifier: '@firebase/firestore',
    firestoreDriverType: 'production',
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firebaseFirestoreQueryDriver()
  };
}
