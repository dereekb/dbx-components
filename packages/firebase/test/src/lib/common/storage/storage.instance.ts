import { AbstractJestTestContextFixture, JestTestContextFactory } from '@dereekb/util/test';
import { FirebaseStorage } from '@dereekb/firebase';
import { TestFirebaseStorageContext } from './storage';

export class TestFirebaseStorageInstance {
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
