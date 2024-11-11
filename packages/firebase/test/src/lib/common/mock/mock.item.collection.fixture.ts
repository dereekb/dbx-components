import { CollectionReference } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util/test';
import { TestFirestoreContextFixture } from '../firestore/firestore.instance';
import { MockItemFirestoreCollection, MockItem } from './mock.item';
import { MockItemCollections, makeMockItemCollections } from './mock.item.service';

// MARK: Test Item Testing Fixture
export class MockItemCollectionFixtureInstance {
  readonly collections: MockItemCollections;

  get collection(): CollectionReference<MockItem> {
    return this.firestoreCollection.collection;
  }
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
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemCollectionFixture extends AbstractWrappedFixtureWithInstance<MockItemCollectionFixtureInstance, TestFirestoreContextFixture> {}

export interface MockItemCollectionFirebaseContextConfig {}

export function testWithMockItemCollectionFixture(config?: MockItemCollectionFirebaseContextConfig): JestTestWrappedContextFactoryBuilder<MockItemCollectionFixture, TestFirestoreContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new MockItemCollectionFixture(fixture),
    makeInstance: (wrap) => new MockItemCollectionFixtureInstance(wrap),
    teardownInstance: (instance: MockItemCollectionFixtureInstance) => {}
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}
