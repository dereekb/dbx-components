import { FirestoreTestContext, FirestoreTestInstance, FirebaseTestingContextFixture } from '../common/firebase';
import { jestTestContextBuilder, Maybe } from "@dereekb/util";
import { makeFirestoreContext } from '../../lib/client/firestore/firestore';
import {
  TestEnvironmentConfig,
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
  TokenOptions,
} from "@firebase/rules-unit-testing";

export interface FirebaseTestingRulesContextConfig {
  userId: string;
  tokenOptions?: Maybe<TokenOptions>;
}

export interface FirebaseTestingConfig {
  testEnvironment: TestEnvironmentConfig;
  rulesContext?: Maybe<FirebaseTestingRulesContextConfig>;
  retainFirestoreBetweenTests?: boolean;
}

export interface RulesUnitTestFirestoreTestContext extends FirestoreTestContext {
  readonly rulesTestEnvironment: RulesTestEnvironment;
  readonly rulesTestContext: RulesTestContext;
}

export function makeRulesTestFirestoreContext(rulesTestEnvironment: RulesTestEnvironment, rulesTestContext: RulesTestContext): FirestoreTestContext {
  const context: RulesUnitTestFirestoreTestContext = {
    ...makeFirestoreContext(rulesTestContext.firestore()),
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

export class RulesUnitTestFirebaseTestingContextFixture extends FirebaseTestingContextFixture<RulesUnitTestFirestoreTestInstance> { }

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseTestBuilder = jestTestContextBuilder<RulesUnitTestFirestoreTestInstance, RulesUnitTestFirebaseTestingContextFixture, FirebaseTestingConfig>({
  buildConfig: (input?: Partial<FirebaseTestingConfig>) => {
    const config: FirebaseTestingConfig = {
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
function rulesTestContextForConfig(rulesTestEnv: RulesTestEnvironment, testingRulesConfig?: Maybe<FirebaseTestingRulesContextConfig>): RulesTestContext {
  let rulesTestContext: RulesTestContext;

  if (testingRulesConfig != null) {
    rulesTestContext = rulesTestEnv.authenticatedContext(testingRulesConfig.userId, testingRulesConfig.tokenOptions ?? undefined);
  } else {
    rulesTestContext = rulesTestEnv.unauthenticatedContext();
  }

  return rulesTestContext;
}
