import { FirebaseStorageAccessorDriver, FirebaseStorageContext, FirebaseStorageDrivers } from '@dereekb/firebase';

/**
 * Used to override/extend a FirebaseStorageAccessorDriver to provide better isolation between tests.
 */
export interface TestingFirebaseStorageAccessorDriver extends FirebaseStorageAccessorDriver {}

/**
 * Drivers used for testing. Provides additional functionality for controlling storage access to prevent cross-test contamination.
 */
export interface TestingFirebaseStorageDrivers extends FirebaseStorageDrivers {
  storageDriverType: 'testing';
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
    storageDriverType: 'testing'
    // todo: if needed
    // storageAccessorDriver: makeTestingFirebaseStorageAccesorDriver(drivers.firestoreAccessorDriver)
  };
}

// MARK: Test FirebaseStorage Context
export interface TestingFirebaseStorageContextExtension {
  drivers: TestingFirebaseStorageDrivers;
}

export type TestFirebaseStorageContext<C = FirebaseStorageContext> = C & TestingFirebaseStorageContextExtension;
