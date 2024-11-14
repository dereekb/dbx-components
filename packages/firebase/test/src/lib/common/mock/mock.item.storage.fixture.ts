import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util/test';
import { TestFirebaseStorage, TestFirebaseStorageContextFixture, TestFirebaseStorageInstance } from '../storage/storage.instance';

// MARK: Test Item Testing Fixture
export class MockItemStorageFixtureInstance implements TestFirebaseStorage {
  private readonly _fixture: MockItemStorageFixture;

  constructor(fixture: MockItemStorageFixture) {
    this._fixture = fixture;
  }

  get fixture() {
    return this._fixture;
  }

  get storage() {
    return this.fixture.parent.storage;
  }

  get storageContext() {
    return this.fixture.parent.storageContext;
  }
}

/**
 * Used to expose a CollectionReference to MockItem for simple tests.
 */
export class MockItemStorageFixture extends AbstractWrappedFixtureWithInstance<MockItemStorageFixtureInstance, TestFirebaseStorageContextFixture> implements TestFirebaseStorage {
  get storage() {
    return this.instance.storage;
  }

  get storageContext() {
    return this.instance.storageContext;
  }
}

export interface MockItemStorageFirebaseStorageContextConfig {}

export function testWithMockItemStorageFixture(config?: MockItemStorageFirebaseStorageContextConfig): JestTestWrappedContextFactoryBuilder<MockItemStorageFixture, TestFirebaseStorageContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new MockItemStorageFixture(fixture),
    makeInstance: (wrap) => new MockItemStorageFixtureInstance(wrap),
    teardownInstance: (instance: MockItemStorageFixtureInstance) => {}
    // TODO(FUTURE): Utilize config here using the setup/teardown later if needed.
  });
}
