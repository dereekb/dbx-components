import { type CollectionReference } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, type TestWrappedContextFactoryBuilder, instanceWrapTestContextFactory } from '@dereekb/util/test';
import { type TestFirestoreContextFixture } from '../firestore/firestore.instance';
import { type MockItemFirestoreCollection, type MockItem } from './mock.item';
import { type MockItemCollections, makeMockItemCollections } from './mock.item.service';

// MARK: Test Item Testing Fixture
/**
 * Provides direct access to all mock item Firestore collections for a single test run.
 *
 * Created by {@link MockItemCollectionFixture} and exposes convenience getters for each
 * mock collection/collection-group. Delegates collection creation to {@link makeMockItemCollections}.
 */
export class MockItemCollectionFixtureInstance {
  readonly collections: MockItemCollections;

  get collection(): CollectionReference<MockItem> {
    return this.mockItemCollection.collection;
  }

  /**
   * @deprecated Use mockItemCollection instead.
   */
  get firestoreCollection(): MockItemFirestoreCollection {
    return this.collections.mockItemCollection;
  }

  get mockItemCollection(): MockItemFirestoreCollection {
    return this.collections.mockItemCollection;
  }

  get mockItemPrivateCollection() {
    return this.collections.mockItemPrivateCollectionFactory;
  }

  get mockItemSubItemCollection() {
    return this.collections.mockItemSubItemCollectionFactory;
  }

  get mockItemSubItemCollectionGroup() {
    return this.collections.mockItemSubItemCollectionGroup;
  }

  get mockItemUserCollection() {
    return this.collections.mockItemUserCollectionFactory;
  }

  get mockItemUserCollectionGroup() {
    return this.collections.mockItemUserCollectionGroup;
  }

  get mockItemSubItemDeepCollection() {
    return this.collections.mockItemSubItemDeepCollectionFactory;
  }

  get mockItemSubItemDeepCollectionGroup() {
    return this.collections.mockItemSubItemDeepCollectionGroup;
  }

  get mockItemSystemState() {
    return this.collections.mockItemSystemStateCollection;
  }

  constructor(readonly fixture: MockItemCollectionFixture) {
    this.collections = makeMockItemCollections(fixture.parent.firestoreContext);
  }
}

/**
 * Test fixture that wraps a {@link TestFirestoreContextFixture} and provides access to
 * all mock item collections via {@link MockItemCollectionFixtureInstance}.
 *
 * Use {@link testWithMockItemCollectionFixture} to create a factory builder for this fixture.
 */
export class MockItemCollectionFixture extends AbstractWrappedFixtureWithInstance<MockItemCollectionFixtureInstance, TestFirestoreContextFixture> {}

/**
 * Configuration options for {@link testWithMockItemCollectionFixture}.
 *
 * Currently empty; reserved for future setup/teardown customization.
 */
export interface MockItemCollectionFirebaseContextConfig {}

/**
 * Creates a {@link TestWrappedContextFactoryBuilder} that sets up a {@link MockItemCollectionFixture}
 * around a parent {@link TestFirestoreContextFixture}.
 *
 * Compose with a Firebase test context factory to get a fully wired test environment:
 *
 * @example
 * ```ts
 * const f = testWithMockItemCollectionFixture()(authorizedFirebaseFactory);
 * describe('my test', () => f.with((instance) => {
 *   it('should work', () => { ... });
 * }));
 * ```
 */
export function testWithMockItemCollectionFixture(_config?: MockItemCollectionFirebaseContextConfig): TestWrappedContextFactoryBuilder<MockItemCollectionFixture, TestFirestoreContextFixture> {
  return instanceWrapTestContextFactory({
    wrapFixture: (fixture) => new MockItemCollectionFixture(fixture),
    makeInstance: (wrap) => new MockItemCollectionFixtureInstance(wrap),
    teardownInstance: (_instance: MockItemCollectionFixtureInstance) => undefined
    // TODO(FUTURE): Utilize config here using the setup/teardown later if needed.
  });
}
