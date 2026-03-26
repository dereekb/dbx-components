import { makeTestingFirestoreDrivers, type TestFirestoreContext, type TestingFirestoreDrivers } from '../common/firestore/firestore';
import { type Maybe, cachedGetter } from '@dereekb/util';
import { type TestContextBuilderFunction, type TestContextFixtureClearInstanceFunction, type BuildTestsWithContextFunction } from '@dereekb/util/test';
import { type TestEnvironmentConfig, initializeTestEnvironment, type RulesTestEnvironment, type RulesTestContext, type TokenOptions, type EmulatorConfig } from '@firebase/rules-unit-testing';
import { firebaseFirestoreClientDrivers, type FirebaseStorage, firebaseStorageClientDrivers, firebaseStorageContextFactory, type Firestore, firestoreContextFactory } from '@dereekb/firebase';
import { setLogLevel } from 'firebase/firestore';
import { makeTestingFirebaseStorageDrivers, type TestFirebaseStorageContext, type TestingFirebaseStorageDrivers } from '../common/storage/storage';
import { TestFirebaseContextFixture, type TestFirebaseInstance } from '../common/firebase.instance';
import { type TestFirebaseStorageInstance } from '../common/storage/storage.instance';

/**
 * Combined driver type providing both Firestore and Firebase Storage testing drivers.
 */
export type TestingFirebaseDrivers = TestingFirestoreDrivers & TestingFirebaseStorageDrivers;

/**
 * Configuration for the authenticated context used in rules unit tests.
 *
 * When provided, the test runs as the specified user. When omitted,
 * tests run as an unauthenticated context.
 */
export interface RulesUnitTestingContextConfig {
  readonly userId: string;
  readonly tokenOptions?: Maybe<TokenOptions>;
}

/**
 * Extended {@link TestEnvironmentConfig} with additional options for emulator setup.
 *
 * The `collectionNames` field is required when using testing drivers that fuzz collection names
 * to isolate parallel test runs.
 */
export interface RulesUnitTestingTestEnvironmentConfig extends TestEnvironmentConfig {
  /**
   * List of collection names used in the environment. Is required if using testing drivers.
   */
  readonly collectionNames?: string[];
  readonly firestore?: EmulatorConfig;
  readonly storage?: EmulatorConfig;
}

/**
 * Top-level configuration for {@link firebaseRulesUnitTestBuilder}.
 *
 * Combines the emulator environment config with an optional authenticated context.
 */
export interface RulesUnitTestingConfig {
  readonly testEnvironment: RulesUnitTestingTestEnvironmentConfig;
  readonly rulesContext?: Maybe<RulesUnitTestingContextConfig>;
}

/**
 * Extends {@link TestFirestoreContext} with references to the underlying `@firebase/rules-unit-testing` objects.
 *
 * Useful when a test needs direct access to the rules test environment (e.g., for clearing data or
 * switching auth contexts).
 */
export interface RulesUnitTestTestFirestoreContext extends TestFirestoreContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

/**
 * Creates a {@link TestFirestoreContext} backed by the rules unit testing emulator.
 *
 * Combines the Firestore client drivers with the rules test environment and context
 * to produce a context suitable for client-side Firestore tests.
 */
export function makeRulesTestFirestoreContext(drivers: TestingFirestoreDrivers, rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): TestFirestoreContext {
  const context: RulesUnitTestTestFirestoreContext = {
    ...firestoreContextFactory(drivers)(rulesTestContext.firestore()),
    drivers,
    rulesTestContext,
    rulesTestEnvironment
  };

  return context;
}

/**
 * Extends {@link TestFirebaseStorageContext} with references to the underlying `@firebase/rules-unit-testing` objects.
 */
export interface RulesUnitTestTestFirebaseStorageContext extends TestFirebaseStorageContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

/**
 * Creates a {@link TestFirebaseStorageContext} backed by the rules unit testing emulator.
 *
 * Combines the Storage client drivers with the rules test environment and context
 * to produce a context suitable for client-side Firebase Storage tests.
 */
export function makeRulesTestFirebaseStorageContext(drivers: TestingFirebaseStorageDrivers, rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): TestFirebaseStorageContext {
  const context: RulesUnitTestTestFirebaseStorageContext = {
    ...firebaseStorageContextFactory(drivers)(rulesTestContext.storage()),
    drivers,
    rulesTestContext,
    rulesTestEnvironment
  };

  return context;
}

/**
 * Test instance that provides both Firestore and Firebase Storage contexts via the
 * `@firebase/rules-unit-testing` emulator.
 *
 * Lazily initializes contexts on first access using {@link cachedGetter}.
 * Used as the instance type for {@link RulesUnitTestFirebaseTestingContextFixture}.
 */
export class RulesUnitTestTestFirebaseInstance implements TestFirebaseInstance, TestFirebaseStorageInstance {
  readonly _firestoreContext = cachedGetter(() => makeRulesTestFirestoreContext(this.drivers, this.rulesTestEnvironment, this.rulesTestContext));
  readonly _storageContext = cachedGetter(() => makeRulesTestFirebaseStorageContext(this.drivers, this.rulesTestEnvironment, this.rulesTestContext));

  constructor(
    readonly drivers: TestingFirebaseDrivers,
    readonly rulesTestEnvironment: RulesTestEnvironment,
    readonly rulesTestContext: RulesTestContext
  ) {}

  get firestoreContext(): TestFirestoreContext {
    return this._firestoreContext();
  }

  get storageContext(): TestFirebaseStorageContext {
    return this._storageContext();
  }

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

/**
 * Concrete {@link TestFirebaseContextFixture} for client-side rules unit tests.
 *
 * Manages the lifecycle of a {@link RulesUnitTestTestFirebaseInstance}, handling
 * setup and teardown of the emulator environment between test suites.
 */
export class RulesUnitTestFirebaseTestingContextFixture extends TestFirebaseContextFixture<RulesUnitTestTestFirebaseInstance> {}

/**
 * A TestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 *
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 *
 * The {@link RulesTestEnvironment} is initialized once per test suite (`beforeAll`) and cleaned up
 * once (`afterAll`), while fresh drivers and a {@link RulesTestContext} are created per test (`beforeEach`). This avoids
 * repeated calls to `initializeTestEnvironment` (which hits the emulator's `PUT /internal/setRules` endpoint),
 * preventing interference between parallel workers sharing the same Firebase Storage emulator. The Storage
 * emulator maintains rules globally (not per-project), so concurrent `setRules` calls from multiple workers
 * can momentarily leave the emulator in a transitional state that causes `storage/unauthorized` errors.
 */
export const firebaseRulesUnitTestBuilder: TestContextBuilderFunction<RulesUnitTestTestFirebaseInstance, RulesUnitTestFirebaseTestingContextFixture, RulesUnitTestingConfig> = (inputConfig?: Partial<RulesUnitTestingConfig>) => {
  const config: RulesUnitTestingConfig = {
    testEnvironment: inputConfig?.testEnvironment ?? {},
    rulesContext: inputConfig?.rulesContext
  };

  return (buildTests: BuildTestsWithContextFunction<RulesUnitTestFirebaseTestingContextFixture>) => {
    const fixture = new RulesUnitTestFirebaseTestingContextFixture();

    let rulesTestEnvironment: RulesTestEnvironment;

    // Initialize the emulator environment once per test suite.
    // This is the expensive operation that hits the emulator's REST API (e.g. PUT /internal/setRules).
    beforeAll(async () => {
      rulesTestEnvironment = await initializeTestEnvironment(config.testEnvironment);
    });

    // Clean up the emulator environment once after all tests complete.
    afterAll(async () => {
      if (rulesTestEnvironment) {
        await rulesTestEnvironment.cleanup().catch((e) => {
          console.warn('firebaseRulesUnitTestBuilder(): Failed to cleanup rules test environment', e);
          throw e;
        });
      }
    });

    // Create fresh drivers and RulesTestContext per test.
    // Drivers are recreated per test because the Firestore testing driver fuzzes collection names
    // (via makeTestingFirestoreAccesorDriver) to provide data isolation between tests.
    let clearInstance: Maybe<TestContextFixtureClearInstanceFunction> = null;

    beforeEach(async () => {
      try {
        const drivers: TestingFirebaseDrivers = {
          ...makeTestingFirestoreDrivers(firebaseFirestoreClientDrivers()),
          ...makeTestingFirebaseStorageDrivers(firebaseStorageClientDrivers(), { useTestDefaultBucket: true })
        };

        if (config.testEnvironment.collectionNames) {
          drivers.firestoreAccessorDriver.initWithCollectionNames(config.testEnvironment.collectionNames);
        }

        const rulesTestContext = rulesTestContextForConfig(rulesTestEnvironment, config.rulesContext);
        const instance = new RulesUnitTestTestFirebaseInstance(drivers, rulesTestEnvironment, rulesTestContext);
        clearInstance = fixture.setInstance(instance);
      } catch (e) {
        console.error('firebaseRulesUnitTestBuilder(): Failed building a test instance. Error: ', e);

        if (clearInstance) {
          clearInstance();
          clearInstance = null;
        }

        throw e;
      }
    });

    // Declare tests
    buildTests(fixture);

    // Clear the instance reference after each test.
    afterEach(() => {
      if (clearInstance) {
        clearInstance();
        clearInstance = null;
      }
    });
  };
};

// MARK: Internal
function rulesTestContextForConfig(rulesTestEnv: RulesTestEnvironment, testingRulesConfig?: Maybe<RulesUnitTestingContextConfig>): RulesTestContext {
  let rulesTestContext: RulesTestContext;

  if (testingRulesConfig != null) {
    rulesTestContext = rulesTestEnv.authenticatedContext(testingRulesConfig.userId, testingRulesConfig.tokenOptions ?? undefined);
  } else {
    rulesTestContext = rulesTestEnv.unauthenticatedContext();
  }

  return rulesTestContext;
}

function rewriteEmulatorConfigRulesForFuzzedCollectionNames(config: EmulatorConfig | undefined, fuzzedCollectionNamesMap: Map<string, string>): EmulatorConfig | undefined {
  if (config && config.rules) {
    config = {
      ...config,
      rules: rewriteRulesForFuzzedCollectionNames(config.rules, fuzzedCollectionNamesMap)
    };
  }

  return config;
}

function rewriteRulesForFuzzedCollectionNames(rules: string | undefined, fuzzedCollectionNamesMap: Map<string, string>): string | undefined {
  // TODO: rewrite the rules using regex matching/replacement.

  return rules;
}

// MARK: Utility
/**
 * Registers `beforeAll`/`afterAll` hooks to suppress verbose Firestore log output during tests.
 *
 * Sets the log level to `'error'` before tests and restores it to `'warn'` afterward.
 * Call this at the top level of a `describe` block to reduce test noise.
 */
export function changeFirestoreLogLevelBeforeAndAfterTests() {
  beforeAll(() => setLogLevel('error'));
  afterAll(() => setLogLevel('warn'));
}
