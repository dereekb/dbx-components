import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions-test';
import { Firestore } from '@google-cloud/firestore';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { FeaturesList } from 'firebase-functions-test/lib/features';
import { TestFirestoreContext, TestFirestoreInstance } from '@dereekb/firebase/test';
import { AbstractJestTestContextFixture, jestTestContextBuilder, JestTestContextFactory, JestTestContextFixture } from "@dereekb/util/test";
import { applyFirebaseGCloudTestProjectIdToFirebaseConfigEnv, getGCloudTestProjectId, isAdminEnvironmentInitialized, rollNewGCloudProjectEnvironmentVariable } from './firebase';
import { FirebaseAdminTestContext, FirebaseAdminTestContextInstance, WrapCloudFunction } from './firebase.admin';
import { Maybe } from '@dereekb/util';

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

export interface FirebaseAdminFunctionTestContext extends FirebaseAdminTestContext { }

export interface FullFirebaseAdminFunctionTestContext extends FirebaseAdminFunctionTestContext, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance> { }

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

  get wrapCloudFunction(): WrapCloudFunction {
    return this.instance.wrap;
  }

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
