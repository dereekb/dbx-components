import { AbstractTestContextFixture, type TestContextFactory } from '@dereekb/util/test';
import { type FirebaseStorage, type Firestore } from '@dereekb/firebase';
import { type TestFirestoreContext } from './firestore/firestore';
import { type TestFirestoreInstance } from './firestore/firestore.instance';
import { type TestFirebaseStorageContext } from './storage/storage';
import { type TestFirebaseStorageInstance } from './storage/storage.instance';

/**
 * Combined test instance that provides access to both Firestore and Firebase Storage test contexts.
 *
 * Use this when your tests need to interact with both Firestore documents and storage files
 * within the same test scenario. Implements both {@link TestFirestoreInstance} and
 * {@link TestFirebaseStorageInstance} so it can be used wherever either is expected.
 */
export class TestFirebaseInstance implements TestFirestoreInstance, TestFirebaseStorageInstance {
  constructor(
    readonly firestoreContext: TestFirestoreContext,
    readonly storageContext: TestFirebaseStorageContext
  ) {}

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

/**
 * Test fixture that manages the lifecycle of a {@link TestFirebaseInstance}, providing
 * convenient access to both Firestore and Storage test contexts.
 *
 * Extends {@link AbstractTestContextFixture} to handle setup/teardown of the combined
 * Firebase test environment. Use this as the base fixture when writing tests that
 * exercise both Firestore and Storage functionality together.
 */
export class TestFirebaseContextFixture<F extends TestFirebaseInstance = TestFirebaseInstance> extends AbstractTestContextFixture<F> {
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

/**
 * Factory type for creating {@link TestFirebaseContextFixture} instances in test suites.
 *
 * Pass this to test utility functions that need to set up a combined Firestore + Storage
 * test environment.
 */
export type TestFirebaseContextFactory = TestContextFactory<TestFirebaseContextFixture>;

// MARK: Compat
/**
 * @deprecated Use TestFirebaseContextFactory instead.
 */
export type JestTestFirebaseContextFactory = TestFirebaseContextFactory;
