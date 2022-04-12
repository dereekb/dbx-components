import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions-test';
import { Firestore } from '@google-cloud/firestore';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { JestTestFirestoreContextFactory, makeTestingFirestoreDrivers, TestFirestoreContext, TestFirestoreContextFixture, TestFirestoreInstance } from '@dereekb/firebase';
import { AbstractJestTestContextFixture, cachedGetter, JestBuildTestsWithContextFunction, jestTestContextBuilder, JestTestContextFactory, JestTestContextFixture, Maybe, useJestContextFixture } from "@dereekb/util";
import { FeaturesList } from 'firebase-functions-test/lib/features';
import { googleCloudFirestoreDrivers } from '../../lib/firestore/driver';
import { GoogleCloudTestFirestoreInstance } from '../firestore/firestore';
import { applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv, generateNewProjectId, getGCloudProjectId, getGCloudTestProjectId, isAdminEnvironmentInitialized, rollNewGCloudProjectEnvironmentVariable } from './firebase';
import { wrap } from 'firebase-functions-test/lib/main';

export interface FirebaseAdminTestConfig { }

export interface FirebaseAdminTestContext {
  readonly app: admin.app.App;
  readonly auth: Auth;
  readonly firestore: Firestore
  readonly firestoreInstance: TestFirestoreInstance;
  readonly firestoreContext: TestFirestoreContext;
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

}

// MARK: FirebaseAdminTestBuilder
export class FirebaseAdminTestContextInstance implements FirebaseAdminTestContext {

  readonly getTestFirestoreInstance = cachedGetter(() => {
    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());
    return new GoogleCloudTestFirestoreInstance(drivers, this.firestore);
  });

  constructor(readonly app: admin.app.App) { }

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
    return this.firestoreInstance.context;
  }

}

export abstract class AbstractFirebaseAdminTestContextInstanceChild<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> implements FirebaseAdminTestContext {

  constructor(readonly parent: F) { }

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
    const app = admin.initializeApp({ projectId });
    return new FirebaseAdminTestContextInstance(app);
  },
  teardownInstance: async (instance, config) => {
    await (instance as FirebaseAdminTestContextInstance).app.delete();  // clean up the instance
  }
});

export type FirebaseAdminTestContextFactory = JestTestContextFactory<FirebaseAdminTestContextFixture>;
export const firebaseAdminTestContextFactory: FirebaseAdminTestContextFactory = firebaseAdminTestBuilder({});

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
    firebaseFunctionsTestInstance.cleanup();  // destroy the old instance if it is up.
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
   * @deprecated Is false by default to allow a new app to be defined each time. Usage of the singleton does not make sense. Remove later, and require that tests be run in serial if jest isn't behaving.
   */
  useFunctionSingletonContext: boolean;
}

export type WrapCloudFunction = typeof wrap;

export interface FirebaseAdminFunctionTestContext extends FirebaseAdminTestContext {
  readonly wrapCloudFunction: WrapCloudFunction;
}

export class FirebaseAdminFunctionTestContextFixture extends AbstractJestTestContextFixture<FirebaseAdminFunctionTestContextInstance> implements FirebaseAdminFunctionTestContext {

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

  get wrapCloudFunction(): WrapCloudFunction {
    return this.instance.wrapCloudFunction;
  }

}

export class FirebaseAdminFunctionTestContextInstance extends FirebaseAdminTestContextInstance implements FirebaseAdminFunctionTestContext {

  constructor(readonly instance: FeaturesList, app: admin.app.App) {
    super(app);
  }

  readonly wrapCloudFunction: WrapCloudFunction = this.instance.wrap;

}

export let DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = false;

export function setDefaultFirebaseAdminFunctionTestUseFunctionSingleton(use: boolean) {
  DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = use;
}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using firebase-admin.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseAdminFunctionTestBuilder = jestTestContextBuilder<FirebaseAdminTestContextInstance, FirebaseAdminFunctionTestContextFixture, FirebaseAdminFunctionTestConfig>({
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
    const app = admin.initializeApp({ projectId });


    return new FirebaseAdminFunctionTestContextInstance(firebaseFunctionsTestInstance!, app);
  },
  teardownInstance: async (instance, config) => {
    if (config.useFunctionSingletonContext === false) {
      try {
        await instance.app.delete(); // will be called in cleanup
        firebaseFunctionsTestInstance!.cleanup();
      } catch (e) {

      }

      firebaseFunctionsTestInstance = undefined;
    }
  }
});

export type FirebaseAdminFunctionTestContextFactory = JestTestContextFactory<FirebaseAdminFunctionTestContextFixture>;
export const firebaseAdminFunctionTestContextFactory: FirebaseAdminFunctionTestContextFactory = firebaseAdminFunctionTestBuilder({});

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
