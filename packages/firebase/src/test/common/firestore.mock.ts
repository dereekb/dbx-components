import { AbstractJestTestContextFixture } from "@dereekb/util";
import { Firestore } from "../../lib/common/firestore/types";
import { TestFirestoreContext } from "./firestore";

export class TestFirestoreInstance {

  constructor(readonly context: TestFirestoreContext) { }

  get firestore(): Firestore {
    return this.context.firestore;
  }

  async clearFirestore(): Promise<void> {

    // return this.context.clearFirestore();
  }

  // TODO: Add storage

}

export class TestFirestoreContextFixture<F extends TestFirestoreInstance = TestFirestoreInstance> extends AbstractJestTestContextFixture<F> {

  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get context(): TestFirestoreContext {
    return this.instance.context;
  }

}
