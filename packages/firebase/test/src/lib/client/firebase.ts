import { makeTestingFirestoreDrivers, type TestFirestoreContext, type TestingFirestoreDrivers } from '../common/firestore/firestore';
import { type Maybe, cachedGetter } from '@dereekb/util';
import { jestTestContextBuilder } from '@dereekb/util/test';
import { type TestEnvironmentConfig, initializeTestEnvironment, type RulesTestEnvironment, type RulesTestContext, type TokenOptions, type EmulatorConfig } from '@firebase/rules-unit-testing';
import { firebaseFirestoreClientDrivers, type FirebaseStorage, firebaseStorageClientDrivers, firebaseStorageContextFactory, type Firestore, firestoreContextFactory } from '@dereekb/firebase';
import { setLogLevel } from 'firebase/firestore';
import { makeTestingFirebaseStorageDrivers, type TestFirebaseStorageContext, type TestFirebaseStorageInstance, type TestingFirebaseStorageDrivers } from '../common';
import { TestFirebaseContextFixture, type TestFirebaseInstance } from '../common/firebase.instance';

export type TestingFirebaseDrivers = TestingFirestoreDrivers & TestingFirebaseStorageDrivers;

export interface RulesUnitTestingContextConfig {
  readonly userId: string;
  readonly tokenOptions?: Maybe<TokenOptions>;
}

export interface RulesUnitTestingTestEnvironmentConfig extends TestEnvironmentConfig {
  /**
   * List of collection names used in the environment. Is required if using testing drivers.
   */
  readonly collectionNames?: string[];
  readonly firestore?: EmulatorConfig;
  readonly storage?: EmulatorConfig;
}

export interface RulesUnitTestingConfig {
  readonly testEnvironment: RulesUnitTestingTestEnvironmentConfig;
  readonly rulesContext?: Maybe<RulesUnitTestingContextConfig>;
}

export interface RulesUnitTestTestFirestoreContext extends TestFirestoreContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

export function makeRulesTestFirestoreContext(drivers: TestingFirestoreDrivers, rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): TestFirestoreContext {
  const context: RulesUnitTestTestFirestoreContext = {
    ...firestoreContextFactory(drivers)(rulesTestContext.firestore()),
    drivers,
    rulesTestContext,
    rulesTestEnvironment
  };

  return context;
}

export interface RulesUnitTestTestFirebaseStorageContext extends TestFirebaseStorageContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

export function makeRulesTestFirebaseStorageContext(drivers: TestingFirebaseStorageDrivers, rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): TestFirebaseStorageContext {
  const context: RulesUnitTestTestFirebaseStorageContext = {
    ...firebaseStorageContextFactory(drivers)(rulesTestContext.storage()),
    drivers,
    rulesTestContext,
    rulesTestEnvironment
  };

  return context;
}

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

export class RulesUnitTestFirebaseTestingContextFixture extends TestFirebaseContextFixture<RulesUnitTestTestFirebaseInstance> {}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 *
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseRulesUnitTestBuilder = jestTestContextBuilder<RulesUnitTestTestFirebaseInstance, RulesUnitTestFirebaseTestingContextFixture, RulesUnitTestingConfig>({
  buildConfig: (input?: Partial<RulesUnitTestingConfig>) => {
    const config: RulesUnitTestingConfig = {
      testEnvironment: input?.testEnvironment ?? {},
      rulesContext: input?.rulesContext
    };

    return config;
  },
  buildFixture: () => new RulesUnitTestFirebaseTestingContextFixture(),
  setupInstance: async (config) => {
    const drivers = {
      ...makeTestingFirestoreDrivers(firebaseFirestoreClientDrivers()),
      ...makeTestingFirebaseStorageDrivers(firebaseStorageClientDrivers(), { useTestDefaultBucket: true })
    };

    let testEnvironment = config.testEnvironment;

    if (config.testEnvironment.collectionNames) {
      const pathsMap = drivers.firestoreAccessorDriver.initWithCollectionNames(config.testEnvironment.collectionNames);
      testEnvironment = {
        ...testEnvironment,
        firestore: rewriteEmulatorConfigRulesForFuzzedCollectionNames(testEnvironment.firestore, pathsMap)
      };
    }

    const rulesTestEnv = await initializeTestEnvironment(config.testEnvironment);
    const rulesTestContext = rulesTestContextForConfig(rulesTestEnv, config.rulesContext);
    return new RulesUnitTestTestFirebaseInstance(drivers, rulesTestEnv, rulesTestContext);
  },
  teardownInstance: async (instance, config) => {
    await instance.rulesTestEnvironment.cleanup(); // Cleanup
  }
});

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
export function changeFirestoreLogLevelBeforeAndAfterTests() {
  beforeAll(() => setLogLevel('error'));
  afterAll(() => setLogLevel('warn'));
}
