import { type FirestoreDrivers } from '@dereekb/firebase';
import { googleCloudFirestoreAccessorDriver } from './driver.accessor';
import { googleCloudFirestoreQueryDriver } from './driver.query';

/**
 * Alias for {@link FirestoreDrivers} specific to the Google Cloud Firestore (server) implementation.
 */
export type GoogleCloudFirestoreDrivers = FirestoreDrivers;

/**
 * Creates a complete set of {@link FirestoreDrivers} for Google Cloud Firestore (Admin SDK).
 *
 * Bundles the server-side accessor driver and query driver, identified as `@google-cloud/firestore`.
 *
 * @returns A complete set of {@link FirestoreDrivers} for the Google Cloud Admin SDK.
 *
 * @example
 * ```typescript
 * const drivers = googleCloudFirestoreDrivers();
 * const context = firestoreContextFactory(drivers);
 * ```
 */
export function googleCloudFirestoreDrivers(): GoogleCloudFirestoreDrivers {
  return {
    firestoreDriverIdentifier: '@google-cloud/firestore',
    firestoreDriverType: 'production',
    firestoreAccessorDriver: googleCloudFirestoreAccessorDriver(),
    firestoreQueryDriver: googleCloudFirestoreQueryDriver()
  };
}
