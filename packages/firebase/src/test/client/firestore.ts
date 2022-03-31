import { FirestoreTestContext, FirestoreTestInstance, FirestoreTestingContextFixture } from '../common/firebase';
import { jestTestContextBuilder, Maybe } from "@dereekb/util";
import { makeFirestoreContext } from '../../lib/client/firestore/firestore';
import {
  TestEnvironmentConfig,
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
  TokenOptions,
} from "@firebase/rules-unit-testing";
import { makeTestingFirestoreContext } from '../common/firestore.mock';

export interface RulesUnitTestingContextConfig {
  userId: string;
  tokenOptions?: Maybe<TokenOptions>;
}

export interface RulesUnitTestingConfig {
  testEnvironment: TestEnvironmentConfig;
  rulesContext?: Maybe<RulesUnitTestingContextConfig>;
  retainFirestoreBetweenTests?: boolean;
}

export interface RulesUnitTestFirestoreTestContext extends FirestoreTestContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

export function makeRulesTestFirestoreContext(rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): FirestoreTestContext {
  const context: RulesUnitTestFirestoreTestContext = {
    ...makeTestingFirestoreContext(makeFirestoreContext(rulesTestContext.firestore())),
    rulesTestContext,
    rulesTestEnvironment,
    clearFirestore: () => rulesTestEnvironment.clearFirestore()
  };

  return context;
}

export class RulesUnitTestFirestoreTestInstance extends FirestoreTestInstance {

  constructor(readonly rulesTestEnvironment: RulesTestEnvironment, readonly rulesTestContext: RulesTestContext) {
    super(makeRulesTestFirestoreContext(rulesTestEnvironment, rulesTestContext));
  }

  // TODO: Add storage

}

export class RulesUnitTestFirebaseTestingContextFixture extends FirestoreTestingContextFixture<RulesUnitTestFirestoreTestInstance> { }

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firestoreTestBuilder = jestTestContextBuilder<RulesUnitTestFirestoreTestInstance, RulesUnitTestFirebaseTestingContextFixture, RulesUnitTestingConfig>({
  buildConfig: (input?: Partial<RulesUnitTestingConfig>) => {
    const config: RulesUnitTestingConfig = {
      testEnvironment: input?.testEnvironment ?? {},
      rulesContext: input?.rulesContext
    };

    return config;
  },
  buildFixture: () => new RulesUnitTestFirebaseTestingContextFixture(),
  setupInstance: async (config) => {
    const rulesTestEnv = await initializeTestEnvironment(config.testEnvironment);
    const rulesTestContext = rulesTestContextForConfig(rulesTestEnv, config.rulesContext);
    return new RulesUnitTestFirestoreTestInstance(rulesTestEnv, rulesTestContext);
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
