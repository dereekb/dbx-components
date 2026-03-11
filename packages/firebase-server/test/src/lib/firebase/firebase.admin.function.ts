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

/**
 * Initializes (or re-initializes) the firebase-functions-test singleton used by all admin function tests.
 *
 * Must be called after {@link initFirebaseAdminTestEnvironment}. When `reroll` is true, a fresh
 * GCloud project ID is generated so successive test suites run against isolated projects.
 *
 * @param reroll - When `true`, generates a new project ID instead of reusing the current one.
 * @returns The initialized {@link FeaturesList} singleton.
 *
 * @throws Error if `initFirebaseAdminTestEnvironment()` has not been called.
 *
 * @example
 * ```ts
 * setupFirebaseAdminFunctionTestSingleton();
 * ```
 */
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

/**
 * Convenience wrapper around {@link setupFirebaseAdminFunctionTestSingleton} that always generates
 * a new GCloud project ID, ensuring complete isolation between test runs.
 *
 * @returns The re-initialized {@link FeaturesList} singleton.
 */
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

/**
 * Test context type for Firebase Admin function tests.
 *
 * Currently an alias for {@link FirebaseAdminTestContext}; exists as a semantic boundary
 * so function-specific extensions can be added without changing downstream signatures.
 */
export type FirebaseAdminFunctionTestContext = FirebaseAdminTestContext;

/**
 * Combined interface providing both the {@link FirebaseAdminFunctionTestContext} services
 * and the {@link TestContextFixture} lifecycle for a {@link FirebaseAdminFunctionTestContextInstance}.
 *
 * Useful when test helpers need access to both the Firebase services and the fixture's
 * `instance` / `parent` references in a single type constraint.
 */
export interface FullFirebaseAdminFunctionTestContext extends FirebaseAdminFunctionTestContext, TestContextFixture<FirebaseAdminFunctionTestContextInstance> {}

/**
 * Fixture that wraps a {@link FirebaseAdminFunctionTestContextInstance} and forwards
 * all {@link FirebaseAdminFunctionTestContext} properties to the underlying instance.
 *
 * Created automatically by {@link firebaseAdminFunctionTestBuilder}; tests receive this
 * fixture and use it to access the Firebase Admin app, Firestore, Auth, Storage, and the
 * firebase-functions-test wrapper during each test lifecycle.
 */
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

/**
 * Concrete instance that extends {@link FirebaseAdminTestContextInstance} with the
 * firebase-functions-test {@link FeaturesList} needed to wrap and invoke Cloud Functions
 * in an emulated environment.
 *
 * Each instance holds a lazily-created {@link FirebaseAdminCloudFunctionWrapper} via `fnWrapper`
 * so Cloud Functions can be wrapped and invoked against the test project.
 */
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

/**
 * Module-level default for {@link FirebaseAdminFunctionTestConfig.useFunctionSingletonContext}.
 *
 * When `false` (the default), each test suite gets its own firebase-functions-test instance
 * with a unique project ID. Change via {@link setDefaultFirebaseAdminFunctionTestUseFunctionSingleton}.
 */
export let DEFAULT_FIREBASE_ADMIN_FUNCTION_TEST_USE_FUNCTION_SINGLETON_CONTEXT = false;

/**
 * Globally sets whether new {@link FirebaseAdminFunctionTestConfig} instances default to
 * singleton mode. Primarily used in global test setup files.
 *
 * @example
 * ```ts
 * // in jest globalSetup
 * setDefaultFirebaseAdminFunctionTestUseFunctionSingleton(true);
 * ```
 */
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

    try {
      app = admin.initializeApp({ projectId, storageBucket });
    } catch (e) {
      if (e instanceof Error && e.message.includes('already exists')) {
        // Safety net: a previous test's teardown failed to delete the app.
        // Delete the stale app and re-initialize with the correct config.
        app = admin.app();
        await app.delete();
        app = admin.initializeApp({ projectId, storageBucket });
      } else {
        throw e;
      }
    }

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

/**
 * Factory type that produces a {@link FirebaseAdminFunctionTestContextFixture} for each test suite.
 */
export type FirebaseAdminFunctionTestContextFactory = TestContextFactory<FirebaseAdminFunctionTestContextFixture>;

/**
 * Pre-built factory using default configuration. Drop this into any test file to get
 * a fully configured Firebase Admin + functions test context with automatic setup/teardown.
 *
 * @example
 * ```ts
 * firebaseAdminFunctionTestContextFactory((f) => {
 *   it('should invoke cloud function', async () => {
 *     const app = f.app;
 *     // ... test logic
 *   });
 * });
 * ```
 */
export const firebaseAdminFunctionTestContextFactory: FirebaseAdminFunctionTestContextFactory = firebaseAdminFunctionTestBuilder({});
