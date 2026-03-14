import { cachedGetter } from '@dereekb/util';
import { type FirebaseStorageAccessorDriver, type FirebaseStorageContext, type FirebaseStorageDrivers } from '@dereekb/firebase';

let bucketTestNameKey = 0;

/**
 * Configuration for {@link makeTestingFirebaseStorageAccesorDriver}.
 */
export interface MakeTestingFirebaseStorageAccessorDriverConfig {
  /**
   * Whether to generate a unique test bucket name as the default bucket.
   *
   * When `true`, a randomized bucket name is always generated. When `false`, the
   * original driver's default bucket is preserved. When omitted, a test bucket is
   * generated only if the base driver does not already define a default bucket.
   */
  useTestDefaultBucket?: boolean;
}

/**
 * Creates a {@link TestingFirebaseStorageAccessorDriver} that wraps the given driver,
 * optionally replacing its default bucket with a unique test bucket name.
 *
 * The generated bucket name incorporates a timestamp and random component so that
 * parallel test runs do not collide on the same bucket.
 *
 * @param driver - The base storage accessor driver to wrap.
 * @param config - Optional configuration controlling test bucket behavior.
 */
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
/**
 * Extension applied to a {@link FirebaseStorageContext} to expose the testing-specific drivers.
 *
 * Mixed into the base context type via {@link TestFirebaseStorageContext} so that
 * test code can access the isolated storage driver.
 */
export interface TestingFirebaseStorageContextExtension {
  drivers: TestingFirebaseStorageDrivers;
}

/**
 * A {@link FirebaseStorageContext} augmented with {@link TestingFirebaseStorageContextExtension},
 * giving tests access to isolated storage drivers with unique bucket names.
 */
export type TestFirebaseStorageContext<C = FirebaseStorageContext> = C & TestingFirebaseStorageContextExtension;
