import { AbstractTestContextFixture, type TestContextFactory } from '@dereekb/util/test';
import { type FirebaseStorage } from '@dereekb/firebase';
import { type TestFirebaseStorageContext } from './storage';

/**
 * Interface describing the minimum shape of a Firebase Storage test instance.
 *
 * Provides access to both the raw {@link FirebaseStorage} reference and the
 * {@link TestFirebaseStorageContext} that includes testing-specific drivers.
 */
export interface TestFirebaseStorage {
  readonly storageContext: TestFirebaseStorageContext;
  readonly storage: FirebaseStorage;
}

/**
 * Test instance that wraps a {@link TestFirebaseStorageContext} and provides convenient
 * access to the underlying Firebase Storage reference.
 *
 * The context includes a test-specific default bucket name to isolate storage operations
 * between test runs.
 */
export class TestFirebaseStorageInstance implements TestFirebaseStorage {
  constructor(readonly storageContext: TestFirebaseStorageContext) {}

  get storage(): FirebaseStorage {
    return this.storageContext.storage;
  }
}

/**
 * Test fixture that manages the lifecycle of a {@link TestFirebaseStorageInstance}.
 *
 * Extends {@link AbstractTestContextFixture} to handle setup/teardown of the Firebase Storage
 * test environment, including isolated bucket naming.
 */
export class TestFirebaseStorageContextFixture<F extends TestFirebaseStorageInstance = TestFirebaseStorageInstance> extends AbstractTestContextFixture<F> {
  get storage(): FirebaseStorage {
    return this.instance.storage;
  }

  get storageContext(): TestFirebaseStorageContext {
    return this.instance.storageContext;
  }
}

/**
 * Factory type for creating {@link TestFirebaseStorageContextFixture} instances in test suites.
 */
export type TestFirebaseStorageContextFactory = TestContextFactory<TestFirebaseStorageContextFixture>;

// MARK: Compat
/**
 * @deprecated Use TestFirebaseStorageContextFactory instead.
 */
export type JestTestFirebaseStorageContextFactory = TestFirebaseStorageContextFactory;
