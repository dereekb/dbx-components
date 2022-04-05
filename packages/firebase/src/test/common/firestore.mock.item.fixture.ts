import { MockItemFirestoreCollection } from '@dereekb/firebase';
import { CollectionReference } from '../../lib/common/firestore/types';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util';
import { MockItem } from './firestore.mock.item';
import { TestFirestoreContextFixture } from './firestore.mock';
import { makeMockItemCollections } from '.';

// MARK: Test Item Testing Fixture
export class MockItemCollectionFixtureInstance {

  readonly collections = makeMockItemCollections(this.fixture.parent.context);

  get firestoreCollection(): MockItemFirestoreCollection {
    return this.collections.mockItem;
  }

  get collection(): CollectionReference<MockItem> {
    return this.firestoreCollection.collection;
  }

  constructor(readonly fixture: MockItemCollectionFixture) { }

}

/**
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemCollectionFixture extends AbstractWrappedFixtureWithInstance<MockItemCollectionFixtureInstance, TestFirestoreContextFixture> { }

export interface MockItemCollectionFirebaseContextConfig { }

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
