import { AbstractJestTestContextFixture, type JestTestContextFactory } from '@dereekb/util/test';
import { type FirebaseStorage } from '@dereekb/firebase';
import { type TestFirebaseStorageContext } from './storage';

export interface TestFirebaseStorage {
  readonly storageContext: TestFirebaseStorageContext;
  readonly storage: FirebaseStorage;
}

export class TestFirebaseStorageInstance implements TestFirebaseStorage {
  constructor(readonly storageContext: TestFirebaseStorageContext) {}

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

export class TestFirebaseStorageContextFixture<F extends TestFirebaseStorageInstance = TestFirebaseStorageInstance> extends AbstractJestTestContextFixture<F> {
  get storage(): FirebaseStorage {
    return this.instance.storage;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.instance.storageContext;
  }
}

export type JestTestFirebaseStorageContextFactory = JestTestContextFactory<TestFirebaseStorageContextFixture>;
