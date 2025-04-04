import { AbstractJestTestContextFixture, type JestTestContextFactory } from '@dereekb/util/test';
import { type Firestore } from '@dereekb/firebase';
import { type TestFirestoreContext } from './firestore';

export class TestFirestoreInstance {
  constructor(readonly firestoreContext: TestFirestoreContext) {}

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }
}

export class TestFirestoreContextFixture<F extends TestFirestoreInstance = TestFirestoreInstance> extends AbstractJestTestContextFixture<F> {
  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.instance.firestoreContext;
  }
}

export type JestTestFirestoreContextFactory = JestTestContextFactory<TestFirestoreContextFixture>;
