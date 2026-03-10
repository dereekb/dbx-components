import { type FirebaseStorageDrivers } from '../../common/storage/driver/driver';
import { firebaseStorageClientAccessorDriver } from './driver.accessor';

/**
 * Client-side {@link FirebaseStorageDrivers} using the `firebase/storage` SDK.
 */
export type FirebaseStorageClientDrivers = FirebaseStorageDrivers;

/**
 * Creates the client-side {@link FirebaseStorageDrivers} that bind the abstract storage driver
 * interfaces to the `firebase/storage` SDK (browser/client).
 *
 * Provides file and folder accessor operations for use with {@link clientFirebaseStorageContextFactory}.
 *
 * @example
 * ```ts
 * const drivers = firebaseStorageClientDrivers();
 * const contextFactory = firebaseStorageContextFactory(drivers);
 * ```
 */
export function firebaseStorageClientDrivers(): FirebaseStorageClientDrivers {
  return {
    storageDriverIdentifier: '@firebase/storage',
    storageDriverType: 'production',
    storageAccessorDriver: firebaseStorageClientAccessorDriver()
  };
}
