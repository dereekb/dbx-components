import { AbstractJestTestContextFixture, JestTestContextFactory } from '@dereekb/util/test';
import { FirebaseStorage, Firestore } from '@dereekb/firebase';
import { TestFirestoreContext } from './firestore/firestore';
import { TestFirestore, TestFirestoreInstance } from './firestore/firestore.instance';
import { TestFirebaseStorageContext } from './storage/storage';
import { TestFirebaseStorage, TestFirebaseStorageInstance } from './storage/storage.instance';

export interface TestFirebase extends TestFirestore, TestFirebaseStorage {}

export class TestFirebaseInstance implements TestFirebase {
  private readonly _firestoreContext: TestFirestoreContext;
  private readonly _storageContext: TestFirebaseStorageContext;

  constructor(firestoreContext: TestFirestoreContext, storageContext: TestFirebaseStorageContext) {
    this._firestoreContext = firestoreContext;
    this._storageContext = storageContext;
  }

  get firestoreContext(): TestFirestoreContext {
    return this._firestoreContext;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this._storageContext;
  }

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

export class TestFirebaseContextFixture<F extends TestFirebase = TestFirebase> extends AbstractJestTestContextFixture<F> {
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
