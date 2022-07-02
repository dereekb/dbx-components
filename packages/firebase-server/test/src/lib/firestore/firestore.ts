import { Firestore } from '@google-cloud/firestore';
import { TestFirestoreContext, TestFirestoreInstance, TestFirestoreContextFixture, TestingFirestoreDrivers, makeTestingFirestoreDrivers } from '@dereekb/firebase/test';
import { jestTestContextBuilder } from '@dereekb/util/test';
import { googleCloudFirestoreDrivers } from '@dereekb/firebase-server';
import { firestoreContextFactory } from '@dereekb/firebase';

export interface GoogleCloudTestFirestoreConfig {
  host: string;
  port: number;
}

export type GoogleCloudTestFirestoreContext = TestFirestoreContext;

export function makeGoogleFirestoreContext(drivers: TestingFirestoreDrivers, firestore: Firestore): TestFirestoreContext {
  const context = firestoreContextFactory(drivers)(firestore) as GoogleCloudTestFirestoreContext;
  context.drivers = drivers;
  return context;
}

export class GoogleCloudTestFirestoreInstance extends TestFirestoreInstance {
  constructor(drivers: TestingFirestoreDrivers, firestore: Firestore) {
    super(makeGoogleFirestoreContext(drivers, firestore));
  }
}

export class GoogleCloudTestFirestoreContextFixture extends TestFirestoreContextFixture<GoogleCloudTestFirestoreInstance> {}

let COUNTER = 0;

/**
 * A JestTestContextBuilderFunction for building firestore test context factories using @google-cloud/firestore. This means SERVER TESTING ONLY. For client testing, look at @dereekb/firestore.
 *
 * This is used to build a @google-cloud/firestore Firestore instance for testing and point it to the emulators.
 *
 * If you need all of Firebase (firebase-admin library), look at adminFirebaseAdminTestBuilder() instead.
 */
export const googleCloudTestFirestoreBuilder = jestTestContextBuilder<GoogleCloudTestFirestoreInstance, GoogleCloudTestFirestoreContextFixture, GoogleCloudTestFirestoreConfig>({
  buildConfig: (input?: Partial<GoogleCloudTestFirestoreConfig>) => {
    const config: GoogleCloudTestFirestoreConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    return config;
  },
  buildFixture: () => new GoogleCloudTestFirestoreContextFixture(),
  setupInstance: async (config) => {
    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());

    const projectId = `firebase-server-test-${new Date().getTime()}-${COUNTER++}`;
    const firestore = new Firestore({
      projectId,
      host: config.host,
      port: config.port,
      maxIdleChannels: 0
    });

    return new GoogleCloudTestFirestoreInstance(drivers, firestore);
  },
  teardownInstance: async (instance, config) => {
    await (instance.firestore as Firestore).terminate();
  }
});
