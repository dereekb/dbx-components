import { CollectionReference } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util/test';
import { MockItemFirestoreCollection, MockItem } from './firestore.mock.item';
import { TestFirestoreContextFixture } from './firestore.mock';
import { makeMockItemCollections } from './firestore.mock.item.service';

// MARK: Test Item Testing Fixture
export class MockItemCollectionFixtureInstance {
  readonly collections = makeMockItemCollections(this.fixture.parent.context);

  get collection(): CollectionReference<MockItem> {
    return this.firestoreCollection.collection;
  }
  get firestoreCollection(): MockItemFirestoreCollection {
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

  get mockItemDeepSubItemCollection() {
    return this.collections.mockItemDeepSubItemCollectionFactory;
  }

  get mockItemDeepSubItemCollectionGroup() {
    return this.collections.mockItemDeepSubItemCollectionGroup;
  }

  constructor(readonly fixture: MockItemCollectionFixture) {}
}

/**
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemCollectionFixture extends AbstractWrappedFixtureWithInstance<MockItemCollectionFixtureInstance, TestFirestoreContextFixture> {}

export interface MockItemCollectionFirebaseContextConfig {}

export function testWithMockItemFixture(config?: MockItemCollectionFirebaseContextConfig): JestTestWrappedContextFactoryBuilder<MockItemCollectionFixture, TestFirestoreContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new MockItemCollectionFixture(fixture),
    makeInstance: (wrap) => new MockItemCollectionFixtureInstance(wrap),
    teardownInstance: (instance: MockItemCollectionFixtureInstance) => {
      // instance.fixture.parent.instance.clearFirestore();
    }
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}
