import { TestFirestoreContextFixture } from '@dereekb/firebase';
import { AbstractWrappedFixtureWithInstance, JestTestWrappedContextFactoryBuilder, instanceWrapJestTestContextFactory } from '@dereekb/util';

// MARK: Demo Api Testing Fixture
export class DemoApiFixtureInstance {

  constructor(readonly fixture: DemoApiFixture) { }

}

/**
 * Used to expose a CollectionReference to DemoApi for simple tests.
 */
export class DemoApiFixture extends AbstractWrappedFixtureWithInstance<DemoApiFixtureInstance, TestFirestoreContextFixture> { }

export interface DemoApiFirebaseContextConfig { }

export function testWithDemoApiFixture(config?: DemoApiFirebaseContextConfig): JestTestWrappedContextFactoryBuilder<DemoApiFixture, TestFirestoreContextFixture> {
  return instanceWrapJestTestContextFactory({
    wrapFixture: (fixture) => new DemoApiFixture(fixture),
    makeInstance: (wrap) => new DemoApiFixtureInstance(wrap),
    teardownInstance: (instance: DemoApiFixtureInstance) => {
      // instance.fixture.parent.instance.clearFirestore();
    },
    // TODO: Utilize config here using the setup/teardown later if needed.
  });
}
