import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory, Maybe } from '@dereekb/util';
import { Firestore, collection, CollectionReference, WithFieldValue, DocumentData, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import { FirebaseTestingContextFixture } from './firebase';
import { authorizedFirebase } from './firebase.context';
import { AbstractFirestoreDocument } from '../lib/firestore/document';
import { FirestoreCollection, makeFirestoreCollection } from '../lib/firestore/firestore';
import { FirestoreDocumentDataAccessor } from '../lib/firestore/accessor';

// MARK: Test Item
/**
 * Data for a test item in our firestore collection.
 */
export interface TestItem {
  test?: boolean;
  value?: Maybe<string>;
}

export class TestItemDocument extends AbstractFirestoreDocument<TestItem> { }

export const testItemCollectionPath = 'test';

/**
 * A way to build a testItemCollection from a firestore instance.
 * 
 * @param firestore 
 * @returns 
 */
export function testItemCollection(firestore: Firestore): CollectionReference<TestItem> {
  return collection(firestore, testItemCollectionPath).withConverter<TestItem>({
    toFirestore(modelObject: WithFieldValue<TestItem>): DocumentData {
      return {
        test: modelObject.test || false,
        value: modelObject.value || null
      };
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): TestItem {
      const data = snapshot.data();
      const result: TestItem = {
        test: data['test'] || false,
        value: data['value'] || null
      };
      return result;
    }
  });
}

export type TestItemFirestoreCollection = FirestoreCollection<TestItem, TestItemDocument>;

export function testItemFirestoreCollection(firestore: Firestore): TestItemFirestoreCollection {
  return makeFirestoreCollection({
    itemsPerPage: 50,
    collection: testItemCollection(firestore),
    makeDocument: (x: FirestoreDocumentDataAccessor<TestItem>) => new TestItemDocument(x)
  });
}

// MARK: Test Item Testing Fixture
export class TestItemCollectionFixtureInstance {

  readonly testItemCollection = testItemCollection(this.fixture.parent.firestore);

  constructor(readonly fixture: TestItemCollectionFixture) { }

}

/**
 * Used to expose a CollectionReference to TestItem for simple tests.
 */
export class TestItemCollectionFixture extends AbstractWrappedFixtureWithInstance<TestItemCollectionFixtureInstance, FirebaseTestingContextFixture> { }

export interface TestItemCollectionFirebaseContextConfig { }

export function testWithTestItemFixture(config?: TestItemCollectionFirebaseContextConfig): JestTestWrappedContextFactoryBuilder<TestItemCollectionFixture, FirebaseTestingContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new TestItemCollectionFixture(fixture),
    makeInstance: (wrap) => new TestItemCollectionFixtureInstance(wrap),
    teardownInstance: (instance: TestItemCollectionFixtureInstance) => {
      // instance.fixture.parent.instance.clearFirestore();
    }
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}

/**
 * Tests within an authorized context.
 */
export const authorizedTestWithTestItemCollection = testWithTestItemFixture()(authorizedFirebase);
