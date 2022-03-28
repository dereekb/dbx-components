import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util';
import { FirebaseTestingContextFixture } from './firebase';
import { authorizedFirebase } from './firebase.context';
import { testItemCollectionReference } from './firebase.context.item';

// MARK: Test Item Testing Fixture
export class TestItemCollectionFixtureInstance {

  readonly testItemCollection = testItemCollectionReference(this.fixture.parent.firestore);

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
