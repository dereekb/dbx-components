import { Firestore } from '@google-cloud/firestore';
import { TestFirestoreContext, TestFirestoreInstance, TestFirestoreContextFixture, TestingFirestoreDrivers, firestoreContextFactory, makeTestingFirestoreDrivers } from '@dereekb/firebase';
import { jestTestContextBuilder } from "@dereekb/util";
import { googleCloudFirestoreContextFactory } from '../lib/firestore/firestore';
import { googleCloudFirestoreDrivers } from '../lib';

export interface GoogleFirestoreConfig {
  host: string;
  port: number;
}

export interface GoogleCloudTestFirestoreContext extends TestFirestoreContext { }

export function makeGoogleFirestoreContext(drivers: TestingFirestoreDrivers, firestore: Firestore): TestFirestoreContext {
  const context = firestoreContextFactory(drivers)(firestore);
  (context as GoogleCloudTestFirestoreContext).drivers = drivers;
  return context as GoogleCloudTestFirestoreContext;
}

export class GoogleCloudTestFirestoreInstance extends TestFirestoreInstance {

  constructor(drivers: TestingFirestoreDrivers, firestore: Firestore) {
    super(makeGoogleFirestoreContext(drivers, firestore));
  }

  // TODO: Add storage

}

export class GoogleFirestoreFirebaseTestingContextFixture extends TestFirestoreContextFixture<GoogleCloudTestFirestoreInstance> { }

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const googleFirestoreTestBuilder = jestTestContextBuilder<GoogleCloudTestFirestoreInstance, GoogleFirestoreFirebaseTestingContextFixture, GoogleFirestoreConfig>({
  buildConfig: (input?: Partial<GoogleFirestoreConfig>) => {
    const config: GoogleFirestoreConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    return config;
  },
  buildFixture: () => new GoogleFirestoreFirebaseTestingContextFixture(),
  setupInstance: async (config) => {

    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());
    const firestore = new Firestore({
      projectId: 'test',
      host: config.host,
      port: config.port
    });

    return new GoogleCloudTestFirestoreInstance(drivers, firestore);
  },
  teardownInstance: async (instance, config) => {
    await (instance.firestore as Firestore).terminate();
  }
});
