import { CollectionReference } from '../../lib/common/firestore/types';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util';
import { FirestoreTestingContextFixture } from './firebase';
import { MockItem, testItemFirestoreCollection } from './firestore.mock.item';

// MARK: Test Item Testing Fixture
export class MockItemCollectionFixtureInstance {

  readonly firestoreCollection = testItemFirestoreCollection(this.fixture.parent.context);

  get collection(): CollectionReference<MockItem> {
    return this.firestoreCollection.collection;
  }

  constructor(readonly fixture: MockItemCollectionFixture) { }

}

/**
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemCollectionFixture extends AbstractWrappedFixtureWithInstance<MockItemCollectionFixtureInstance, FirestoreTestingContextFixture> { }

export interface MockItemCollectionFirebaseContextConfig { }

export function testWithMockItemFixture(config?: MockItemCollectionFirebaseContextConfig): JestTestWrappedContextFactoryBuilder<MockItemCollectionFixture, FirestoreTestingContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new MockItemCollectionFixture(fixture),
    makeInstance: (wrap) => new MockItemCollectionFixtureInstance(wrap),
    teardownInstance: (instance: MockItemCollectionFixtureInstance) => {
      // instance.fixture.parent.instance.clearFirestore();
    }
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}
