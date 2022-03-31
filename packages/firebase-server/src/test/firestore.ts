import { Firestore } from '@google-cloud/firestore';
import { FirestoreTestContext, FirestoreTestInstance, FirestoreTestingContextFixture, makeTestingFirestoreContext } from '@dereekb/firebase';
import { jestTestContextBuilder } from "@dereekb/util";
import { makeFirestoreContext } from '../lib/firestore/firestore';

export interface GoogleFirestoreConfig {
  host: string;
  port: number;
}

export interface GoogleFirestoreTestContext extends FirestoreTestContext { }

export function makeGoogleFirestoreContext(firestore: Firestore): FirestoreTestContext {
  const context: GoogleFirestoreTestContext = {
    ...makeFirestoreContext(firestore),
    clearFirestore: () => {
      // todo: ....

      return Promise.resolve();
    }
  };

  return context;
}

export class GoogleFirestoreTestInstance extends FirestoreTestInstance {

  constructor(firestore: Firestore) {
    super(makeTestingFirestoreContext(makeGoogleFirestoreContext(firestore)));
  }

  // TODO: Add storage

}

export class GoogleFirestoreFirebaseTestingContextFixture extends FirestoreTestingContextFixture<GoogleFirestoreTestInstance> { }

/**
 * A JestTestContextBuilderFunction for building firebase test context factories using @firebase/firebase and @firebase/rules-unit-testing. This means CLIENT TESTING ONLY. For server testing, look at @dereekb/firestore-server.
 * 
 * This can be used to easily build a testing context that sets up RulesTestEnvironment for tests that sets itself up and tears itself down.
 */
export const googleFirestoreTestBuilder = jestTestContextBuilder<GoogleFirestoreTestInstance, GoogleFirestoreFirebaseTestingContextFixture, GoogleFirestoreConfig>({
  buildConfig: (input?: Partial<GoogleFirestoreConfig>) => {
    const config: GoogleFirestoreConfig = {
      host: input?.host ?? 'localhost',
      port: input?.port ?? 0
    };

    return config;
  },
  buildFixture: () => new GoogleFirestoreFirebaseTestingContextFixture(),
  setupInstance: async (config) => {

    const firestore = new Firestore({
      projectId: 'test',
      host: config.host,
      port: config.port
    });

    return new GoogleFirestoreTestInstance(firestore);
  },
  teardownInstance: async (instance, config) => {
    await (instance.firestore as Firestore).terminate();
  }
});
