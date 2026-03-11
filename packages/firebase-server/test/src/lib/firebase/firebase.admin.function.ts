import admin from 'firebase-admin';
import functions from 'firebase-functions-test';
import { type Firestore } from '@google-cloud/firestore';
import { type Auth } from 'firebase-admin/auth';
import { type FeaturesList } from 'firebase-functions-test/lib/features';
import { type TestFirebaseStorageContext, type TestFirebaseStorageInstance, type TestFirestoreContext, type TestFirestoreInstance } from '@dereekb/firebase/test';
import { AbstractTestContextFixture, testContextBuilder, type TestContextFactory, type TestContextFixture } from '@dereekb/util/test';
import { applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv, getGCloudTestProjectId, isAdminEnvironmentInitialized, rollNewGCloudProjectEnvironmentVariable } from './firebase';
import { type FirebaseAdminTestContext, FirebaseAdminTestContextInstance } from './firebase.admin';
import { type Maybe, cachedGetter } from '@dereekb/util';
import { firebaseAdminCloudFunctionWrapper } from './firebase.function';
import { type Storage as GoogleCloudStorage } from '@google-cloud/storage';

// MARK: FirebaseAdminFunctionTestBuilder
let functionsInitialized = false;

/**
 * firebase-functions-test uses a singleton internally, so we must track the reference to properly tear it down too.
 */
let firebaseFunctionsTestInstance: Maybe<FeaturesList>;

export function setupFirebaseAdminFunctionTestSingleton(reroll = false) {
  if (!isAdminEnvironmentInitialized()) {
    throw new Error('initFirebaseAdminTestEnvironment() was not called.');
  }

  if (firebaseFunctionsTestInstance) {
    firebaseFunctionsTestInstance.cleanup(); // destroy the old instance if it is up.
  }

  firebaseFunctionsTestInstance = functions();

  if (reroll) {
    rollNewGCloudProjectEnvironmentVariable();
  } else {
    applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv();
  }

  functionsInitialized = true;
  return firebaseFunctionsTestInstance;
}

export function rerollFirebaseAdminFunctionTestSingleton() {
  return setupFirebaseAdminFunctionTestSingleton(true);
}

export interface FirebaseAdminFunctionTestConfig {
  /**
   * Whether or not the use the functions singleton. Is true by default. Requires that setupFirebaseAdminFunctionTestSingleton() be called.
   *
   * If false, your tests may need to be run in serial rather than parallel to avoid cross-test contamination.
   *
   * @deprecated Is false by default to allow a new app to be defined each time. Usage of the singleton does not make sense. Remove later, and require that tests be run in serial if testing framework isn't behaving.
   */
  useFunctionSingletonContext: boolean;
}

export type FirebaseAdminFunctionTestContext = FirebaseAdminTestContext;

export interface FullFirebaseAdminFunctionTestContext extends FirebaseAdminFunctionTestContext, TestContextFixture<FirebaseAdminFunctionTestContextInstance> {}

export class FirebaseAdminFunctionTestContextFixture extends AbstractTestContextFixture<FirebaseAdminFunctionTestContextInstance> implements FirebaseAdminFunctionTestContext {
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

export class FirebaseAdminFunctionTestContextInstance extends FirebaseAdminTestContextInstance implements FirebaseAdminFunctionTestContext {
  private _fnWrapper = cachedGetter(() => firebaseAdminCloudFunctionWrapper(this.instance));

  constructor(
    readonly instance: FeaturesList,
    app: admin.app.App
  ) {
    super(app);
  }

  override get fnWrapper() {
    return this._fnWrapper();
  }
}

export let DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = false;

export function setDefaultFirebaseAdminFunctionTestUseFunctionSingleton(use: boolean) {
  DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = use;
}

/**
 * A TestContextBuilderFunction for building firebase test context factories using firebase-admin.
 *
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseAdminFunctionTestBuilder = testContextBuilder<FirebaseAdminTestContextInstance, FirebaseAdminFunctionTestContextFixture, FirebaseAdminFunctionTestConfig>({
  buildConfig: (input?: Partial<FirebaseAdminFunctionTestConfig>) => {
    const config: FirebaseAdminFunctionTestConfig = {
      ...input,
      useFunctionSingletonContext: input?.useFunctionSingletonContext ?? DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT
    };

    return config;
  },
  buildFixture: () => new FirebaseAdminFunctionTestContextFixture(),
  setupInstance: async (config) => {
    if (!isAdminEnvironmentInitialized()) {
      throw new Error('initFirebaseAdminTestEnvironment() (in @dereekb/firebase-server package) was not called before using adminFirebaseTestBuilder().');
    }

    if (config.useFunctionSingletonContext) {
      if (!functionsInitialized) {
        throw new Error('Call setupFirebaseAdminFunctionTestSingleton() (in @dereekb/firebase-server package) if using functions in a singleton context (useFunctionSingletonContext = true/undefined).');
      }
    } else if (config.useFunctionSingletonContext === false) {
      firebaseFunctionsTestInstance = rerollFirebaseAdminFunctionTestSingleton();
    }

    const projectId = getGCloudTestProjectId();
    const storageBucket = 'b-' + projectId;
    let app: admin.app.App;

    app = admin.initializeApp({ projectId, storageBucket });

    // Proposed Solution A
    /*
    try {
      app = admin.initializeApp({ projectId, storageBucket });
    } catch (e) {
      if (e instanceof Error && e.message.includes('A Firebase app named "[DEFAULT]" already exists')) {
        app = admin.app();    // try to reuse it. Usually this means that the app failed to initialize.
      } else {
        throw e;
      }
    }
    */

    // Propose Solution B
    /*
    try {
      app = admin.initializeApp({ projectId, storageBucket });
    } catch (e) {
      if (e instanceof Error && e.message.includes('A Firebase app named "[DEFAULT]" already exists')) {
        app = admin.app();
        await app.delete(); // delete existing app

        // re-initialize with the new details
        app = admin.initializeApp({ projectId, storageBucket });
      } else {
        throw e;
      }
    }
    */

    return new FirebaseAdminFunctionTestContextInstance(firebaseFunctionsTestInstance!, app);
  },
  teardownInstance: async (instance, config) => {
    if (!config.useFunctionSingletonContext) {
      try {
        await instance.app.delete(); // will be called in cleanup
        firebaseFunctionsTestInstance!.cleanup();
      } catch (e) {
        // do nothing
      }

      firebaseFunctionsTestInstance = undefined;
    }
  }
});

export type FirebaseAdminFunctionTestContextFactory = TestContextFactory<FirebaseAdminFunctionTestContextFixture>;
export const firebaseAdminFunctionTestContextFactory: FirebaseAdminFunctionTestContextFactory = firebaseAdminFunctionTestBuilder({});
