import { CollectionReference } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util/test';
import { MockItemFirestoreCollection, MockItem } from './mock.item';
import { TestFirestoreContextFixture } from '../firestore/firestore.instance';
import { TestFirebaseStorageContextFixture } from '../storage/storage.instance';

// MARK: Test Item Testing Fixture
export class MockItemStorageFixtureInstance {
  constructor(readonly fixture: MockItemStorageFixture) {}
}

/**
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemStorageFixture extends AbstractWrappedFixtureWithInstance<MockItemStorageFixtureInstance, TestFirebaseStorageContextFixture> {}

export interface MockItemStorageFirebaseStorageContextConfig {}

export function testWithMockItemStorageFixture(config?: MockItemStorageFirebaseStorageContextConfig): JestTestWrappedContextFactoryBuilder<MockItemStorageFixture, TestFirebaseStorageContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new MockItemStorageFixture(fixture),
    makeInstance: (wrap) => new MockItemStorageFixtureInstance(wrap),
    teardownInstance: (instance: MockItemStorageFixtureInstance) => {}
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}
