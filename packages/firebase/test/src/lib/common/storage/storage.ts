import { FirebaseStorageAccessorDriver, FirebaseStorageDrivers } from '@dereekb/firebase';

/**
 * Used to override/extend a FirebaseStorageAccessorDriver to provide better isolation between tests.
 */
export interface TestingFirebaseStorageAccessorDriver extends FirebaseStorageAccessorDriver {}

/**
 * Drivers used for testing. Provides additional functionality for controlling storage access to prevent cross-test contamination.
 */
export interface TestingFirebaseStorageDrivers extends FirebaseStorageDrivers {
  driverType: 'testing';
  storageAccessorDriver: TestingFirebaseStorageAccessorDriver;
}

/**
 * Extends the input drivers to generate new drivers for a testing environment.
 *
 * @param drivers
 * @returns
 */
export function makeTestingFirebaseStorageDrivers(drivers: FirebaseStorageDrivers): TestingFirebaseStorageDrivers {
  return {
    ...drivers,
    driverType: 'testing'
    // todo: if needed
    // storageAccessorDriver: makeTestingFirebaseStorageAccesorDriver(drivers.firestoreAccessorDriver)
  };
}
