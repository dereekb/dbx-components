import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { JestTestFirestoreContextFactory, makeTestingFirestoreDrivers, TestFirestoreContext, TestFirestoreContextFixture, TestFirestoreInstance, makeTestingFirebaseStorageDrivers, TestFirebaseStorageContext, TestFirebaseStorageInstance } from '@dereekb/firebase/test';
import { AbstractJestTestContextFixture, JestBuildTestsWithContextFunction, jestTestContextBuilder, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from '@dereekb/util/test';
import { googleCloudFirebaseStorageDrivers, googleCloudFirestoreDrivers, googleCloudStorageFromFirebaseAdminStorage } from '@dereekb/firebase-server';
import { GoogleCloudTestFirestoreInstance } from '../firestore/firestore';
import { generateNewProjectId, isAdminEnvironmentInitialized } from './firebase';
import { cachedGetter } from '@dereekb/util';
import { FirebaseAdminCloudFunctionWrapper, FirebaseAdminCloudFunctionWrapperSource } from './firebase.function';
import { Storage as GoogleCloudStorage } from '@google-cloud/storage';
import { GoogleCloudTestFirebaseStorageInstance } from '../storage/storage';

export interface FirebaseAdminTestConfig {}

export interface FirebaseAdminTestContext extends FirebaseAdminCloudFunctionWrapperSource {
  readonly app: admin.app.App;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly firestoreInstance: TestFirestoreInstance;
  readonly firestoreContext: TestFirestoreContext;
  readonly storage: GoogleCloudStorage;
  readonly storageInstance: TestFirebaseStorageInstance;
  readonly storageContext: TestFirebaseStorageContext;
}

export class FirebaseAdminTestContextFixture extends AbstractJestTestContextFixture<FirebaseAdminTestContextInstance> implements FirebaseAdminTestContext {
  // MARK: FirebaseAdminTestContext (Forwarded)
  get app(): admin.app.App {
    return this.instance.app;
  }

  get auth(): Auth {
    return this.instance.auth;
  }

  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get firestoreInstance(): TestFirestoreInstance {
    return this.instance.firestoreInstance;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.instance.firestoreContext;
  }

  get storage(): GoogleCloudStorage {
    return this.instance.storage;
  }

  get storageInstance(): TestFirebaseStorageInstance {
    return this.instance.storageInstance;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.instance.storageContext;
  }

  get fnWrapper() {
    return this.instance.fnWrapper;
  }
}

// MARK: FirebaseAdminTestBuilder
export class FirebaseAdminTestContextInstance implements FirebaseAdminTestContext {
  readonly getTestFirestoreInstance = cachedGetter(() => {
    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());
    return new GoogleCloudTestFirestoreInstance(drivers, this.firestore);
  });

  readonly getTestFirebaseStorageInstance = cachedGetter(() => {
    const drivers = makeTestingFirebaseStorageDrivers(googleCloudFirebaseStorageDrivers());
    return new GoogleCloudTestFirebaseStorageInstance(drivers, this.storage);
  });

  constructor(readonly app: admin.app.App) {}

  get auth(): Auth {
    return this.app.auth();
  }

  get firestore(): Firestore {
    return this.app.firestore();
  }

  get firestoreInstance(): TestFirestoreInstance {
    return this.getTestFirestoreInstance();
  }

  get firestoreContext(): TestFirestoreContext {
    return this.firestoreInstance.firestoreContext;
  }

  get storage(): GoogleCloudStorage {
    return googleCloudStorageFromFirebaseAdminStorage(this.app.storage());
  }

  get storageInstance(): TestFirebaseStorageInstance {
    return this.getTestFirebaseStorageInstance();
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.storageInstance.storageContext;
  }

  get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    throw new Error('wrapCloudFunction is unsupported by this type.');
  }
}

export abstract class AbstractFirebaseAdminTestContextInstanceChild<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> implements FirebaseAdminTestContext {
  constructor(readonly parent: F) {}

  // MARK: FirebaseAdminTestContext (Forwarded)
  get app(): admin.app.App {
    return this.parent.app;
  }

  get auth(): Auth {
    return this.parent.auth;
  }

  get firestore(): Firestore {
    return this.parent.firestore;
  }

  get firestoreInstance(): TestFirestoreInstance {
    return this.parent.firestoreInstance;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.parent.firestoreContext;
  }

  get storage(): GoogleCloudStorage {
    return this.parent.storage;
  }

  get storageInstance(): TestFirebaseStorageInstance {
    return this.parent.storageInstance;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.parent.storageContext;
  }

  get fnWrapper(): FirebaseAdminCloudFunctionWrapper {
    return this.parent.fnWrapper;
  }
}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using firebase-admin.
 *
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseAdminTestBuilder = jestTestContextBuilder<FirebaseAdminTestContextInstance, FirebaseAdminTestContextFixture, FirebaseAdminTestConfig>({
  buildConfig: (input?: Partial<FirebaseAdminTestConfig>) => {
    const config: FirebaseAdminTestConfig = {
      ...input
    };

    return config;
  },
  buildFixture: () => new FirebaseAdminTestContextFixture(),
  setupInstance: async (config) => {
    if (!isAdminEnvironmentInitialized()) {
      throw new Error('Call initFirebaseAdminTestEnvironment() from @dereekb/firebase-server was not called before using adminFirebaseTestBuilder().');
    }

    const projectId = generateNewProjectId();
    const storageBucket = 'b-' + projectId;
    const app = admin.initializeApp({ projectId, storageBucket });

    return new FirebaseAdminTestContextInstance(app);
  },
  teardownInstance: async (instance, config) => {
    await (instance as FirebaseAdminTestContextInstance).app.delete(); // clean up the instance
  }
});

export type FirebaseAdminTestContextFactory = JestTestContextFactory<FirebaseAdminTestContextFixture>;
export const firebaseAdminTestContextFactory: FirebaseAdminTestContextFactory = firebaseAdminTestBuilder({});

// MARK: Firestore Context
/**
 * Convenience function to build a JestTestFirestoreContextFactory from a FirebaseAdminTestContextFactory.
 *
 * This is useful for composing child tests that will benefit from the firestore testing context, but want the full app available.
 *
 * @param factory
 * @returns
 */
export function firebaseAdminFirestoreContextFixture(factory: JestTestContextFactory<JestTestContextFixture<FirebaseAdminTestContextInstance>>): JestTestFirestoreContextFactory {
  return (buildTests: JestBuildTestsWithContextFunction<TestFirestoreContextFixture>) => {
    factory((f) => firebaseAdminFirestoreContextWithFixture(f, buildTests));
  };
}

export function firebaseAdminFirestoreContextWithFixture(f: JestTestContextFixture<FirebaseAdminTestContextInstance>, buildTests: JestBuildTestsWithContextFunction<TestFirestoreContextFixture>) {
  useJestContextFixture({
    fixture: new TestFirestoreContextFixture(),
    /**
     * Build tests by passing the fixture to the testing functions.
     *
     * This will inject all tests and sub Jest lifecycle items.
     */
    buildTests,
    initInstance: () => f.instance.getTestFirestoreInstance()
  });
}
