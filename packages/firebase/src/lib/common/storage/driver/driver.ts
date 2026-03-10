import { type FirebaseStorageAccessorDriverRef } from './accessor';

/**
 * Unique identifier string for a storage driver implementation.
 */
export type FirebaseStorageDriverIdentifier = string;

/**
 * Indicates whether the driver targets production Firebase or a test/emulator environment.
 */
export type FirebaseStorageDriverType = 'production' | 'testing';

/**
 * Aggregates all storage driver references needed by {@link FirebaseStorageContext}.
 *
 * The driver abstraction allows swapping between production (Firebase/Google Cloud) and testing
 * (in-memory or emulator) implementations without changing consumer code.
 */
export interface FirebaseStorageDrivers extends FirebaseStorageAccessorDriverRef {
  readonly storageDriverIdentifier?: FirebaseStorageDriverIdentifier;
  readonly storageDriverType: FirebaseStorageDriverType;
}
