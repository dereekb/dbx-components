
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util';
import { Firestore, collection, CollectionReference, DocumentReference } from '@firebase/firestore';
import { WithFieldValue, DocumentData, PartialWithFieldValue, SetOptions, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import { FirestoreDocument } from '../lib/firestore';
import { FirebaseTestingContextFixture } from './firebase';
import { authorizedFirebase } from './firebase.context';

// MARK: Test Item
/**
 * Data for a test item in our firestore collection.
 */
export interface TestItem {
  test?: boolean;
}

export class TestItemDocument implements FirestoreDocument<TestItem> {

  constructor(readonly documentRef: DocumentReference<TestItem>) { }

}

export const testItemCollectionPath = 'test';

/**
 * A way to build a testItemCollection from a firestore instance.
 * 
 * @param firestore 
 * @returns 
 */
export function testItemCollection(firestore: Firestore): CollectionReference<TestItem> {
  return collection(firestore, testItemCollectionPath).withConverter<TestItem>({

    // TODO: Change later?

    toFirestore(modelObject: WithFieldValue<TestItem>): DocumentData {
      return {
        test: false
      };
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): TestItem {
      const data = snapshot.data();
      const result: TestItem = { test: data['test'] || false };
      return result;
    }
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
