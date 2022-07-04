import { AbstractJestTestContextFixture, JestTestContextFactory } from '@dereekb/util/test';
import { FirebaseStorage, Firestore } from '@dereekb/firebase';
import { TestFirestoreContext } from './firestore/firestore';
import { TestFirestoreInstance } from './firestore/firestore.instance';
import { TestFirebaseStorageContext } from './storage/storage';
import { TestFirebaseStorageInstance } from './storage/storage.instance';

export class TestFirebaseInstance implements TestFirestoreInstance, TestFirebaseStorageInstance {
  constructor(readonly firestoreContext: TestFirestoreContext, readonly storageContext: TestFirebaseStorageContext) {}

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

export class TestFirebaseContextFixture<F extends TestFirebaseInstance = TestFirebaseInstance> extends AbstractJestTestContextFixture<F> {
  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.instance.firestoreContext;
  }

  get storage(): FirebaseStorage {
    return this.instance.storage;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.instance.storageContext;
  }
}

export type JestTestFirebaseContextFactory = JestTestContextFactory<TestFirebaseContextFixture>;
