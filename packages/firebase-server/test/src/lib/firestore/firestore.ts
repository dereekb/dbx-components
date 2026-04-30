import { Firestore } from '@google-cloud/firestore';
import { type TestFirestoreContext, TestFirestoreInstance, TestFirestoreContextFixture, type TestingFirestoreDrivers, makeTestingFirestoreDrivers } from '@dereekb/firebase/test';
import { testContextBuilder } from '@dereekb/util/test';
import { googleCloudFirestoreDrivers } from '@dereekb/firebase-server';
import { firestoreContextFactory } from '@dereekb/firebase';

/**
 * Configuration for connecting to a Google Cloud Firestore emulator in tests.
 */
export interface GoogleCloudTestFirestoreConfig {
  host: string;
  port: number;
}

/**
 * A {@link TestFirestoreContext} backed by `@google-cloud/firestore`.
 *
 * Alias provided for clarity when working within the Google Cloud test context builders.
 */
export type GoogleCloudTestFirestoreContext = TestFirestoreContext;

/**
 * Creates a {@link TestFirestoreContext} wired to a `@google-cloud/firestore` {@link Firestore} instance.
 *
 * The returned context has its `drivers` property set to the provided testing drivers,
 * which enables test-specific behaviors (e.g., subcollection queries, batch operations)
 * backed by the Google Cloud Firestore driver.
 *
 * @param drivers - Testing-aware Firestore driver set to attach to the context.
 * @param firestore - The `@google-cloud/firestore` Firestore instance (typically pointed at an emulator).
 */
export function makeGoogleFirestoreContext(drivers: TestingFirestoreDrivers, firestore: Firestore): TestFirestoreContext {
  const context = firestoreContextFactory(drivers)(firestore) as GoogleCloudTestFirestoreContext;
  context.drivers = drivers;
  return context;
}

/**
 * A {@link TestFirestoreInstance} backed by `@google-cloud/firestore`.
 *
 * Each instance is constructed with its own {@link Firestore} instance and testing drivers,
 * providing an isolated Firestore context for a single test run.
 */
export class GoogleCloudTestFirestoreInstance extends TestFirestoreInstance {
  constructor(drivers: TestingFirestoreDrivers, firestore: Firestore) {
    super(makeGoogleFirestoreContext(drivers, firestore));
  }
}

/**
 * Test context fixture for `@google-cloud/firestore`-backed Firestore tests.
 *
 * Manages the lifecycle of a {@link GoogleCloudTestFirestoreInstance}, setting it up
 * before each test and tearing it down afterward via the {@link testContextBuilder} infrastructure.
 */
export class GoogleCloudTestFirestoreContextFixture extends TestFirestoreContextFixture<GoogleCloudTestFirestoreInstance> {}

let COUNTER = 0;

/**
 * A TestContextBuilderFunction for building firestore test context factories using @google-cloud/firestore. This means SERVER TESTING ONLY. For client testing, look at @dereekb/firestore.
 *
 * This is used to build a @google-cloud/firestore Firestore instance for testing and point it to the emulators.
 *
 * If you need all of Firebase (firebase-admin library), look at adminFirebaseAdminTestBuilder() instead.
 */
export const googleCloudTestFirestoreBuilder = testContextBuilder<GoogleCloudTestFirestoreInstance, GoogleCloudTestFirestoreContextFixture, GoogleCloudTestFirestoreConfig>({
  buildConfig: (input?: Partial<GoogleCloudTestFirestoreConfig>) => {
    const config: GoogleCloudTestFirestoreConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    return config;
  },
  buildFixture: () => new GoogleCloudTestFirestoreContextFixture(),
  setupInstance: async (config) => {
    const random = Math.floor(Math.random() * 10000);
    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());

    const projectId = `test-${COUNTER++}-${Date.now()}-${random}`.substring(0, 30);
    const firestore = new Firestore({
      projectId,
      host: config.host,
      port: config.port,
      maxIdleChannels: 0
    });

    return new GoogleCloudTestFirestoreInstance(drivers, firestore);
  },
  teardownInstance: async (instance, _config) => {
    await (instance.firestore as Firestore).terminate();
  }
});
