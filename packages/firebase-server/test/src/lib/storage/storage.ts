import { Storage as GoogleCloudStorage } from '@google-cloud/storage';
import { type TestFirebaseStorageContext, TestFirebaseStorageInstance, TestFirebaseStorageContextFixture, type TestingFirebaseStorageDrivers, makeTestingFirebaseStorageDrivers } from '@dereekb/firebase/test';
import { testContextBuilder } from '@dereekb/util/test';
import { googleCloudFirebaseStorageDrivers } from '@dereekb/firebase-server';
import { type FirebaseStorage, firebaseStorageContextFactory } from '@dereekb/firebase';

/**
 * Configuration for connecting to a Google Cloud Storage emulator in tests.
 */
export interface GoogleCloudTestFirebaseStorageConfig {
  host: string;
  port: number;
}

/**
 * A {@link TestFirebaseStorageContext} backed by `@google-cloud/storage`.
 *
 * Alias provided for clarity when working within the Google Cloud test context builders.
 */
export type GoogleCloudTestFirebaseStorageContext = TestFirebaseStorageContext;

/**
 * Creates a {@link TestFirebaseStorageContext} wired to a `@google-cloud/storage` instance.
 *
 * The returned context has its `drivers` property set to the provided testing drivers,
 * enabling test-specific behaviors backed by the Google Cloud Storage driver.
 *
 * @param drivers - Testing-aware storage driver set to attach to the context.
 * @param firebaseStorage - The `@google-cloud/storage` Storage instance (typically pointed at an emulator).
 * @param defaultBucketId - Optional default bucket name; when provided, storage operations that omit a bucket will use this.
 */
export function makeGoogleFirebaseStorageContext(drivers: TestingFirebaseStorageDrivers, firebaseStorage: FirebaseStorage, defaultBucketId?: string): TestFirebaseStorageContext {
  const context = firebaseStorageContextFactory(drivers)(firebaseStorage, { defaultBucketId }) as GoogleCloudTestFirebaseStorageContext;
  context.drivers = drivers;
  return context;
}

/**
 * A {@link TestFirebaseStorageInstance} backed by `@google-cloud/storage`.
 *
 * Each instance is constructed with its own Storage instance, testing drivers, and optional
 * default bucket ID, providing an isolated storage context for a single test run.
 */
export class GoogleCloudTestFirebaseStorageInstance extends TestFirebaseStorageInstance {
  constructor(drivers: TestingFirebaseStorageDrivers, firebaseStorage: FirebaseStorage, defaultBucketId?: string) {
    super(makeGoogleFirebaseStorageContext(drivers, firebaseStorage, defaultBucketId));
  }
}

/**
 * Test context fixture for `@google-cloud/storage`-backed Firebase Storage tests.
 *
 * Manages the lifecycle of a {@link GoogleCloudTestFirebaseStorageInstance}, setting it up
 * before each test and tearing it down afterward via the {@link testContextBuilder} infrastructure.
 */
export class GoogleCloudTestFirebaseStorageContextFixture extends TestFirebaseStorageContextFixture<GoogleCloudTestFirebaseStorageInstance> {}

let COUNTER = 0;

/**
 * A TestContextBuilderFunction for building firebase storage test context factories using @google-cloud/storage. This means SERVER TESTING ONLY. For client testing, look at @dereekb/firestore.
 *
 * This is used to build a @google-cloud/storage FirebaseStorage instance for testing and point it to the emulators.
 *
 * If you need all of Firebase (firebase-admin library), look at adminFirebaseAdminTestBuilder() instead.
 */
export const googleCloudTestFirebaseStorageBuilder = testContextBuilder<GoogleCloudTestFirebaseStorageInstance, GoogleCloudTestFirebaseStorageContextFixture, GoogleCloudTestFirebaseStorageConfig>({
  buildConfig: (input?: Partial<GoogleCloudTestFirebaseStorageConfig>) => {
    const config: GoogleCloudTestFirebaseStorageConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    if (!config.port) {
      throw new Error('Port for host is required.');
    }

    return config;
  },
  buildFixture: () => new GoogleCloudTestFirebaseStorageContextFixture(),
  setupInstance: async (config) => {
    const drivers = makeTestingFirebaseStorageDrivers(googleCloudFirebaseStorageDrivers());

    const projectId = `firebase-storage-server-test-${new Date().getTime()}-${COUNTER++}`;
    const firebaseStorage = new GoogleCloudStorage({
      projectId,
      // ensure http:// is provided so the library doesn't default to/try https://
      apiEndpoint: `http://${config.host}:${config.port}`
    });

    const defaultBucketId = projectId;
    return new GoogleCloudTestFirebaseStorageInstance(drivers, firebaseStorage, defaultBucketId);
  },
  teardownInstance: async (instance, config) => {
    // nothing to teardown
  }
});
