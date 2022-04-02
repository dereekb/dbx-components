import { makeTestingFirestoreDrivers, TestFirestoreContext, TestingFirestoreDrivers } from '../common/firestore';
import { jestTestContextBuilder, Maybe } from "@dereekb/util";
import { makeFirebaseFirestoreContext } from '../../lib/client/firestore/firestore';
import {
  TestEnvironmentConfig,
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
  TokenOptions,
  EmulatorConfig,
} from "@firebase/rules-unit-testing";
import { TestFirestoreContextFixture, TestFirestoreInstance } from '../common/firestore.mock';
import { firebaseFirestoreClientDrivers } from '../../lib/client/firestore/driver';
import { firestoreContextFactory } from '../../lib/common/firestore/context';

export interface RulesUnitTestingContextConfig {
  userId: string;
  tokenOptions?: Maybe<TokenOptions>;
}

export interface RulesUnitTestingTestEnvironmentConfig extends TestEnvironmentConfig {
  /**
   * List of collection names used in the environment. Is required if using testing drivers.
   */
  collectionNames?: string[];
  firestore?: EmulatorConfig;
}

export interface RulesUnitTestingConfig {
  testEnvironment: RulesUnitTestingTestEnvironmentConfig;
  rulesContext?: Maybe<RulesUnitTestingContextConfig>;
  retainFirestoreBetweenTests?: boolean;
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

export class RulesUnitTestTestFirestoreInstance extends TestFirestoreInstance {

  constructor(drivers: TestingFirestoreDrivers, readonly rulesTestEnvironment: RulesTestEnvironment, readonly rulesTestContext: RulesTestContext) {
    super(makeRulesTestFirestoreContext(drivers, rulesTestEnvironment, rulesTestContext));
  }

  // TODO: Add storage

}

export class RulesUnitTestFirebaseTestingContextFixture extends TestFirestoreContextFixture<RulesUnitTestTestFirestoreInstance> { }

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firestoreTestBuilder = jestTestContextBuilder<RulesUnitTestTestFirestoreInstance, RulesUnitTestFirebaseTestingContextFixture, RulesUnitTestingConfig>({
  buildConfig: (input?: Partial<RulesUnitTestingConfig>) => {
    const config: RulesUnitTestingConfig = {
      testEnvironment: input?.testEnvironment ?? {},
      rulesContext: input?.rulesContext
    };

    return config;
  },
  buildFixture: () => new RulesUnitTestFirebaseTestingContextFixture(),
  setupInstance: async (config) => {

    const drivers = makeTestingFirestoreDrivers(firebaseFirestoreClientDrivers());
    let testEnvironment = config.testEnvironment;

    if (config.testEnvironment.collectionNames) {
      const pathsMap = drivers.firestoreAccessorDriver.initWithCollectionNames(config.testEnvironment.collectionNames);
      testEnvironment = {
        ...testEnvironment,
        firestore: rewriteEmulatorConfigRulesForFuzzedCollectionNames(testEnvironment.firestore, pathsMap),
      };
    }

    const rulesTestEnv = await initializeTestEnvironment(config.testEnvironment);
    const rulesTestContext = rulesTestContextForConfig(rulesTestEnv, config.rulesContext);
    return new RulesUnitTestTestFirestoreInstance(drivers, rulesTestEnv, rulesTestContext);
  },
  teardownInstance: async (instance, config) => {
    if (config.retainFirestoreBetweenTests !== true) {
      await instance.clearFirestore();  // Clear the firestore
    }

    await instance.rulesTestEnvironment.cleanup();  // Cleanup
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
