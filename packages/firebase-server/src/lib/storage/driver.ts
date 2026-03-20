import { type FirebaseStorageDrivers } from '@dereekb/firebase';
import { googleCloudStorageFirebaseStorageAccessorDriver } from './driver.accessor';

/**
 * Alias for {@link FirebaseStorageDrivers} specific to the Google Cloud Storage (server) implementation.
 */
export type GoogleCloudFirebaseStorageDrivers = FirebaseStorageDrivers;

/**
 * Creates a complete set of {@link FirebaseStorageDrivers} for Google Cloud Storage (Admin SDK).
 *
 * Bundles the server-side storage accessor driver, identified as `@google-cloud/storage`.
 *
 * @returns A complete set of storage drivers for server-side usage.
 *
 * @example
 * ```typescript
 * const drivers = googleCloudFirebaseStorageDrivers();
 * const context = firebaseStorageContextFactory(drivers);
 * ```
 */
export function googleCloudFirebaseStorageDrivers(): GoogleCloudFirebaseStorageDrivers {
  return {
    storageDriverIdentifier: '@google-cloud/storage',
    storageDriverType: 'production',
    storageAccessorDriver: googleCloudStorageFirebaseStorageAccessorDriver()
  };
}
