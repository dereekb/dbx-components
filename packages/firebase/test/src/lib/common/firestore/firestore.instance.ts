import { AbstractJestTestContextFixture, JestTestContextFactory } from '@dereekb/util/test';
import { Firestore } from '@dereekb/firebase';
import { TestFirestoreContext } from './firestore';

export interface TestFirestore {
  readonly firestoreContext: TestFirestoreContext;
  readonly firestore: Firestore;
}

export class TestFirestoreInstance implements TestFirestore {
  private readonly _firestoreContext: TestFirestoreContext;

  constructor(firestoreContext: TestFirestoreContext) {
    this._firestoreContext = firestoreContext;
  }

  get firestoreContext(): TestFirestoreContext {
    return this._firestoreContext;
  }

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }
}

export class TestFirestoreContextFixture<F extends TestFirestore = TestFirestore> extends AbstractJestTestContextFixture<F> implements TestFirestore {
  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.instance.firestoreContext;
  }
}

export type JestTestFirestoreContextFactory = JestTestContextFactory<TestFirestoreContextFixture>;
