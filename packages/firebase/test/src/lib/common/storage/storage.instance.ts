import { AbstractJestTestContextFixture, JestTestContextFactory } from '@dereekb/util/test';
import { FirebaseStorage } from '@dereekb/firebase';
import { TestFirebaseStorageContext } from './storage';

export interface TestFirebaseStorage {
  readonly storageContext: TestFirebaseStorageContext;
  readonly storage: FirebaseStorage;
}

export class TestFirebaseStorageInstance implements TestFirebaseStorage {
  private _storageContext: TestFirebaseStorageContext;

  constructor(storageContext: TestFirebaseStorageContext) {
    this._storageContext = storageContext;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this._storageContext;
  }

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

export class TestFirebaseStorageContextFixture<F extends TestFirebaseStorageInstance = TestFirebaseStorageInstance> extends AbstractJestTestContextFixture<F> implements TestFirebaseStorage {
  get storage(): FirebaseStorage {
    return this.instance.storage;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.instance.storageContext;
  }
}

export type JestTestFirebaseStorageContextFactory = JestTestContextFactory<TestFirebaseStorageContextFixture>;
