import { CollectionReference } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util/test';
import { makeMockItemCollections, MockItemFirestoreCollection, MockItem } from './firestore.mock.item';
import { TestFirestoreContextFixture } from './firestore.mock';

// MARK: Test Item Testing Fixture
export class MockItemCollectionFixtureInstance {
  readonly collections = makeMockItemCollections(this.fixture.parent.context);

  get collection(): CollectionReference<MockItem> {
    return this.firestoreCollection.collection;
  }
  get firestoreCollection(): MockItemFirestoreCollection {
    return this.collections.mockItem;
  }

  get mockItemPrivateCollection() {
    return this.collections.mockItemPrivate;
  }

  get mockItemSubItemCollection() {
    return this.collections.mockItemSubItem;
  }

  get mockItemSubItemCollectionGroup() {
    return this.collections.mockItemSubItemGroup;
  }

  get mockItemDeepSubItemCollection() {
    return this.collections.mockItemDeepSubItem;
  }

  get mockItemDeepSubItemCollectionGroup() {
    return this.collections.mockItemDeepSubItemGroup;
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
