import { Firestore } from '../lib/common';
import { AbstractJestTestContextFixture, jestTestContextBuilder, JestTestContextFactory, Maybe } from "@dereekb/util";

// import { connectFirestoreEmulator } from "firebase/firestore";

export interface FirebaseTestingRulesContextConfig {
  userId: string;
  tokenOptions?: Maybe<TokenOptions>;
}

export interface FirebaseTestingConfig {
  testEnvironment: TestEnvironmentConfig;
  rulesContext?: Maybe<FirebaseTestingRulesContextConfig>;
  retainFirestoreBetweenTests?: boolean;
}

export class FirebaseTestInstance {

  private readonly _firestore: Firestore = this.rulesTestContext.firestore() as any;

  constructor(readonly rulesTestEnvironment: RulesTestEnvironment, readonly rulesTestContext: RulesTestContext) { }

  get firestore(): Firestore {
    return this._firestore;
  }

  clearFirestore(): Promise<void> {
    return this.rulesTestEnvironment.clearFirestore();
  }

  // TODO: Add storage

}

export class FirebaseTestingContextFixture extends AbstractJestTestContextFixture<FirebaseTestInstance> {

  // MARK: From Instance
  get firestore(): Firestore {
    return this.instance.firestore;
  }

}

/**
 * A JestTestContextBuilderFunction for building firebase test context factories.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const firebaseTestBuilder = jestTestContextBuilder<FirebaseTestInstance, FirebaseTestingContextFixture, FirebaseTestingConfig>({
  buildConfig: (input?: Partial<FirebaseTestingConfig>) => {
    const config: FirebaseTestingConfig = {
      testEnvironment: input?.testEnvironment ?? {},
      rulesContext: input?.rulesContext
    };

    return config;
  },
  buildFixture: () => new FirebaseTestingContextFixture(),
  setupInstance: async (config) => {
    const rulesTestEnv = await initializeTestEnvironment(config.testEnvironment);
    const rulesTestContext = rulesTestContextForConfig(rulesTestEnv, config.rulesContext);
    return new FirebaseTestInstance(rulesTestEnv, rulesTestContext);
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
