import * as functions from 'firebase-functions-test';
import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';
import { FirestoreContext, JestTestFirestoreContextFactory, makeTestingFirestoreDrivers, TestFirestoreContext, TestFirestoreContextFixture, TestFirestoreInstance } from '@dereekb/firebase';
import { AbstractJestTestContextFixture, cachedGetter, JestBuildTestsWithContextFunction, jestTestContextBuilder, JestTestContextFactory, JestTestContextFixture, Maybe, useJestContextFixture } from "@dereekb/util";
import { FeaturesList } from 'firebase-functions-test/lib/features';
import { googleCloudFirestoreDrivers } from '../../lib/firestore/driver';
import { GoogleCloudTestFirestoreInstance } from '../firestore/firestore';

let adminEnvironmentInitialized = false;
let functionsInitialized = false;

/**
 * Host url:port combo.
 * 
 * I.E. localhost:8080
 */
export type FirebaseAdminTestEnvironmentHost = string;

export interface FirebaseAdminTestEnvironmentEmulatorsConfig {
  auth: FirebaseAdminTestEnvironmentHost | null;
  storage: FirebaseAdminTestEnvironmentHost | null;
  firestore: FirebaseAdminTestEnvironmentHost | null;
}

export interface FirebaseAdminTestEnvironmentConfig {
  emulators: FirebaseAdminTestEnvironmentEmulatorsConfig;
}

export function generateNewProjectId() {
  const projectId = 'firebase-test-' + new Date().getTime();
  return projectId;
}

export function rollNewGCloudProjectEnvironmentVariable() {
  const projectId = generateNewProjectId();
  process.env.GCLOUD_PROJECT = projectId;
  return projectId;
}

/**
 * Should be called before calling/using adminFirebaseTestBuilder(). This should only be called once.
 */
export function initFirebaseAdminTestEnvironment(config: FirebaseAdminTestEnvironmentConfig) {

  function crashForEmulator(emulator: string) {
    throw new Error(`Emulator for ${emulator} was not set null or to a host. Crashing to prevent contamination.`);
  }

  function configureEmulator(emulator: keyof FirebaseAdminTestEnvironmentEmulatorsConfig, envKey: string) {
    const emulatorConfig = config.emulators.firestore;

    if (emulatorConfig) {
      process.env[envKey] = emulatorConfig;
    } else if (config.emulators.firestore !== null) {
      crashForEmulator(emulator);
    }
  }

  rollNewGCloudProjectEnvironmentVariable();
  configureEmulator('auth', 'FIREBASE_AUTH_EMULATOR_HOST');
  configureEmulator('firestore', 'FIRESTORE_EMULATOR_HOST');
  configureEmulator('storage', 'FIREBASE_STORAGE_EMULATOR_HOST');

  adminEnvironmentInitialized = true;
}

export interface FirebaseAdminTestConfig { }

export interface FirebaseAdminTestContext {

  readonly firestoreContext: TestFirestoreContext;

}

export class FirebaseAdminTestContextFixture extends AbstractJestTestContextFixture<FirebaseAdminTestInstance> { }

// MARK: FirebaseAdminTestBuilder
export class FirebaseAdminTestInstance implements FirebaseAdminTestInstance {

  readonly getTestFirestoreInstance = cachedGetter(() => {
    const drivers = makeTestingFirestoreDrivers(googleCloudFirestoreDrivers());
    return new GoogleCloudTestFirestoreInstance(drivers, this.firestore);
  });

  constructor(readonly app: admin.app.App) { }

  get firestore(): Firestore {
    return this.app.firestore();
  }

  get firestoreInstance(): TestFirestoreInstance {
    return this.getTestFirestoreInstance();
  }

  get firestoreContext(): FirestoreContext {
    return this.firestoreInstance.context;
  }

}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using firebase-admin.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseAdminTestBuilder = jestTestContextBuilder<FirebaseAdminTestInstance, FirebaseAdminTestContextFixture, FirebaseAdminTestConfig>({
  buildConfig: (input?: Partial<FirebaseAdminTestConfig>) => {
    const config: FirebaseAdminTestConfig = {
      ...input
    };

    return config;
  },
  buildFixture: () => new FirebaseAdminTestContextFixture(),
  setupInstance: async (config) => {

    if (!adminEnvironmentInitialized) {
      throw new Error('Call initFirebaseAdminTestEnvironment() from @dereekb/firebase-server was not called before using adminFirebaseTestBuilder().');
    }

    const projectId = generateNewProjectId();
    const app = admin.initializeApp({ projectId });
    return new FirebaseAdminTestInstance(app);
  },
  teardownInstance: async (instance, config) => {
    await (instance as FirebaseAdminTestInstance).app.delete();  // clean up the instance
  }
});

export type FirebaseAdminTestContextFactory = JestTestContextFactory<FirebaseAdminTestContextFixture>;
export const firebaseAdminTestContextFactory: FirebaseAdminTestContextFactory = firebaseAdminTestBuilder({});

// MARK: FirebaseAdminFunctionTestBuilder
/**
 * firebase-functions-test uses a singleton internally, so we must track the reference to properly tear it down too.
 */
let firebaseFunctionsTestInstance: Maybe<FeaturesList>;

export function setupFirebaseAdminFunctionTestSingleton() {
  if (!adminEnvironmentInitialized) {
    throw new Error('initFirebaseAdminTestEnvironment() was not called.');
  }

  if (firebaseFunctionsTestInstance) {
    firebaseFunctionsTestInstance.cleanup();  // destroy the old instance if it is up.
  }

  firebaseFunctionsTestInstance = functions();
  functionsInitialized = true;
}

export interface FirebaseAdminFunctionTestConfig {
  /**
   * Whether or not the use the functions singleton. Is true by default. Requires that setupFirebaseAdminFunctionTestSingleton() be called.
   * 
   * If false, your tests may need to be run in serial rather than parallel to avoid cross-test contamination.
   */
  useFunctionSingletonContext: boolean;
}

export class FirebaseAdminFunctionTestContextFixture extends AbstractJestTestContextFixture<FirebaseAdminFunctionTestInstance> { }

export class FirebaseAdminFunctionTestInstance extends FirebaseAdminTestInstance {

  constructor(readonly instance: FeaturesList, app: admin.app.App) {
    super(app);
  }

}

export let DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = true;

export function setDefaultFirebaseAdminFunctionTestUseFunctionSingleton(use: boolean) {
  DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = use;
}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using firebase-admin.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseAdminFunctionTestBuilder = jestTestContextBuilder<FirebaseAdminTestInstance, FirebaseAdminFunctionTestContextFixture, FirebaseAdminFunctionTestConfig>({
  buildConfig: (input?: Partial<FirebaseAdminFunctionTestConfig>) => {
    const config: FirebaseAdminFunctionTestConfig = {
      ...input,
      useFunctionSingletonContext: input?.useFunctionSingletonContext ?? DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT
    };

    return config;
  },
  buildFixture: () => new FirebaseAdminFunctionTestContextFixture(),
  setupInstance: async (config) => {

    if (!adminEnvironmentInitialized) {
      throw new Error('initFirebaseAdminTestEnvironment() (in @dereekb/firebase-server package) was not called before using adminFirebaseTestBuilder().');
    }

    if (config.useFunctionSingletonContext && !functionsInitialized) {
      throw new Error('Call setupFirebaseAdminFunctionTestSingleton() (in @dereekb/firebase-server package) if using functions in a singleton context (useFunctionSingletonContext = true/undefined).');
    } else if (config.useFunctionSingletonContext === false) {
      firebaseFunctionsTestInstance = functions();
    }

    const app = admin.initializeApp();
    return new FirebaseAdminFunctionTestInstance(firebaseFunctionsTestInstance!, app);
  },
  teardownInstance: async (instance, config) => {
    if (config.useFunctionSingletonContext === false) {
      await admin.app().delete();
      firebaseFunctionsTestInstance!.cleanup();
      firebaseFunctionsTestInstance = undefined;
    }

    await (instance as FirebaseAdminFunctionTestInstance).app.delete();  // clean up the instance
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
export function firebaseAdminFirestoreContextFixture(factory: JestTestContextFactory<JestTestContextFixture<FirebaseAdminTestInstance>>): JestTestFirestoreContextFactory {
  return (buildTests: JestBuildTestsWithContextFunction<TestFirestoreContextFixture>) => {
    factory((f) => firebaseAdminFirestoreContextWithFixture(f, buildTests));
  };
}

export function firebaseAdminFirestoreContextWithFixture(f: JestTestContextFixture<FirebaseAdminTestInstance>, buildTests: JestBuildTestsWithContextFunction<TestFirestoreContextFixture>) {
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
