import { AbstractTestContextFixture, type TestContextFactory } from '@dereekb/util/test';
import { type Firestore } from '@dereekb/firebase';
import { type TestFirestoreContext } from './firestore';

/**
 * Test instance that wraps a {@link TestFirestoreContext} and provides convenient access
 * to the underlying Firestore instance.
 *
 * Acts as the core building block for Firestore-only test scenarios. The context includes
 * fuzzed collection names to ensure test isolation.
 */
export class TestFirestoreInstance {
  constructor(readonly firestoreContext: TestFirestoreContext) {}

  get firestore(): Firestore {
    return this.firestoreContext.firestore;
  }
}

/**
 * Test fixture that manages the lifecycle of a {@link TestFirestoreInstance}.
 *
 * Extends {@link AbstractTestContextFixture} to handle setup/teardown of the Firestore
 * test environment, including fuzzed collection drivers for test isolation.
 */
export class TestFirestoreContextFixture<F extends TestFirestoreInstance = TestFirestoreInstance> extends AbstractTestContextFixture<F> {
  get firestore(): Firestore {
    return this.instance.firestore;
  }

  get firestoreContext(): TestFirestoreContext {
    return this.instance.firestoreContext;
  }
}

/**
 * Factory type for creating {@link TestFirestoreContextFixture} instances in test suites.
 */
export type TestFirestoreContextFactory = TestContextFactory<TestFirestoreContextFixture>;

// MARK: Compat
/**
 * @deprecated Use TestFirestoreContextFactory instead.
 */
export type JestTestFirestoreContextFactory = TestFirestoreContextFactory;
