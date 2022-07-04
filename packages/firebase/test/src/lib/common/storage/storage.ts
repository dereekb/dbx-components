import { FirebaseStorageAccessorDriver, FirebaseStorageContext, FirebaseStorageDrivers } from '@dereekb/firebase';

let bucketTestNameKey = 0;

export function makeTestingFirebaseStorageAccesorDriver(driver: FirebaseStorageAccessorDriver): TestingFirebaseStorageAccessorDriver {
  const time = new Date().getTime();
  const random = Math.ceil(Math.random() * 999999) % 999999;
  const testBucketName = `test-bucket-${time}-${random}-${(bucketTestNameKey += 1)}`;

  const injectedDriver: TestingFirebaseStorageAccessorDriver = {
    ...driver,
    defaultBucket: () => testBucketName
  };

  return injectedDriver;
}
/**
 * Used to override/extend a FirebaseStorageAccessorDriver to provide better isolation between tests.
 */
export type TestingFirebaseStorageAccessorDriver = FirebaseStorageAccessorDriver;

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
    storageDriverType: 'testing',
    storageAccessorDriver: makeTestingFirebaseStorageAccesorDriver(drivers.storageAccessorDriver)
  };
}

// MARK: Test FirebaseStorage Context
export interface TestingFirebaseStorageContextExtension {
  drivers: TestingFirebaseStorageDrivers;
}

export type TestFirebaseStorageContext<C = FirebaseStorageContext> = C & TestingFirebaseStorageContextExtension;
