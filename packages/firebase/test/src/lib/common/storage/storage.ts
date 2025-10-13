import { cachedGetter } from '@dereekb/util';
import { type FirebaseStorageAccessorDriver, type FirebaseStorageContext, type FirebaseStorageDrivers } from '@dereekb/firebase';

let bucketTestNameKey = 0;

export interface MakeTestingFirebaseStorageAccessorDriverConfig {
  useTestDefaultBucket?: boolean;
}

export function makeTestingFirebaseStorageAccesorDriver(driver: FirebaseStorageAccessorDriver, config?: MakeTestingFirebaseStorageAccessorDriverConfig): TestingFirebaseStorageAccessorDriver {
  const { useTestDefaultBucket } = config ?? {};

  // The default bucket is only used if another bucket is not input.
  const defaultBucket =
    (!driver.getDefaultBucket && useTestDefaultBucket !== false) || useTestDefaultBucket === true
      ? cachedGetter(() => {
          const time = new Date().getTime();
          const random = Math.ceil(Math.random() * 999999) % 999999;
          const testBucketName = `test-bucket-${time}-${random}-${(bucketTestNameKey += 1)}`;
          return testBucketName;
        })
      : driver.getDefaultBucket;

  const injectedDriver: TestingFirebaseStorageAccessorDriver = {
    ...driver,
    getDefaultBucket: defaultBucket
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
export function makeTestingFirebaseStorageDrivers(drivers: FirebaseStorageDrivers, config?: MakeTestingFirebaseStorageAccessorDriverConfig): TestingFirebaseStorageDrivers {
  return {
    ...drivers,
    storageDriverType: 'testing',
    storageAccessorDriver: makeTestingFirebaseStorageAccesorDriver(drivers.storageAccessorDriver, config)
  };
}

// MARK: Test FirebaseStorage Context
export interface TestingFirebaseStorageContextExtension {
  drivers: TestingFirebaseStorageDrivers;
}

export type TestFirebaseStorageContext<C = FirebaseStorageContext> = C & TestingFirebaseStorageContextExtension;
