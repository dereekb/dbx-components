import { Firestore, FirestoreContext } from '../../lib/common';
import { AbstractJestTestContextFixture } from "@dereekb/util";

export interface FirestoreTestContext extends FirestoreContext {
  clearFirestore(): Promise<void>;
}

export class FirestoreTestInstance {

  constructor(readonly context: FirestoreTestContext) { }

  get firestore(): Firestore {
    return this.context.firestore;
  }

  clearFirestore(): Promise<void> {
    return this.context.clearFirestore();
  }

  // TODO: Add storage

}

export class FirebaseTestingContextFixture<F extends FirestoreTestInstance = FirestoreTestInstance> extends AbstractJestTestContextFixture<F> {

  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get context(): FirestoreTestContext {
    return this.instance.context;
  }

}
