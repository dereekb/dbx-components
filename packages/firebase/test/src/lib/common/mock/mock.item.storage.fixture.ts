import { AbstractWrappedFixtureWithInstance, type TestWrappedContextFactoryBuilder, instanceWrapTestContextFactory } from '@dereekb/util/test';
import { type TestFirebaseStorage, type TestFirebaseStorageContextFixture, type TestFirebaseStorageInstance } from '../storage/storage.instance';

// MARK: Test Item Testing Fixture
/**
 * Provides access to Firebase Storage for a single test run within a mock item context.
 *
 * Created by {@link MockItemStorageFixture} and exposes the parent fixture's storage and storage context.
 */
export class MockItemStorageFixtureInstance implements TestFirebaseStorageInstance {
  constructor(readonly fixture: MockItemStorageFixture) {}

  get storage() {
    return this.fixture.parent.storage;
  }

  get storageContext() {
    return this.fixture.parent.storageContext;
  }
}

/**
 * Test fixture that wraps a {@link TestFirebaseStorageContextFixture} and provides access to
 * Firebase Storage via {@link MockItemStorageFixtureInstance}.
 *
 * Use {@link testWithMockItemStorageFixture} to create a factory builder for this fixture.
 */
export class MockItemStorageFixture extends AbstractWrappedFixtureWithInstance<MockItemStorageFixtureInstance, TestFirebaseStorageContextFixture> implements TestFirebaseStorage {
  get storage() {
    return this.instance.storage;
  }

  get storageContext() {
    return this.instance.storageContext;
  }
}

/**
 * Configuration options for {@link testWithMockItemStorageFixture}.
 *
 * Currently empty; reserved for future setup/teardown customization.
 */
export interface MockItemStorageFirebaseStorageContextConfig {}

/**
 * Creates a {@link TestWrappedContextFactoryBuilder} that sets up a {@link MockItemStorageFixture}
 * around a parent {@link TestFirebaseStorageContextFixture}.
 *
 * Compose with a Firebase test context factory to get a fully wired storage test environment:
 *
 * @example
 * ```ts
 * const f = testWithMockItemStorageFixture()(authorizedFirebaseFactory);
 * describe('storage test', () => f.with((instance) => {
 *   it('should upload', () => { ... });
 * }));
 * ```
 */
export function testWithMockItemStorageFixture(config?: MockItemStorageFirebaseStorageContextConfig): TestWrappedContextFactoryBuilder<MockItemStorageFixture, TestFirebaseStorageContextFixture> {
  return instanceWrapTestContextFactory({
    wrapFixture: (fixture) => new MockItemStorageFixture(fixture),
    makeInstance: (wrap) => new MockItemStorageFixtureInstance(wrap),
    teardownInstance: (instance: MockItemStorageFixtureInstance) => {}
    // TODO(FUTURE): Utilize config here using the setup/teardown later if needed.
  });
}
