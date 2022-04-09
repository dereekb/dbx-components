import { firebaseAdminFunctionNestContextFactory, FirebaseAdminFunctionTestInstance, firebaseAdminNestContextFactory, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestInstance, FirebaseAdminTestInstance, firebaseServerAppTokenProvider, initFirebaseAdminTestEnvironment, setupFirebaseAdminFunctionTestSingleton } from '@dereekb/firebase-server';
import { asGetter, JestBuildTestsWithContextFunction } from '@dereekb/util';
import { Module } from '@nestjs/common';
import { DemoApiAppModule } from '../app/app.module';

// MARK: Demo Api Testing Fixture
@Module({
  imports: [DemoApiAppModule]
})
export class TestDemoApiAppModule { }

/**
 * Used to expose a CollectionReference to DemoApi for simple tests.
 */
export type DemoApiContextFixture<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance> = FirebaseAdminNestTestContextFixture<F, DemoApiContextFixtureInstance<F>>;
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance> extends FirebaseAdminNestTestInstance<F> { }

export function initDemoApiTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:9903',
      firestore: '0.0.0.0:9904',
      storage: '0.0.0.0:9906'
    }
  });
  setupFirebaseAdminFunctionTestSingleton();
}

const _demoApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestDemoApiAppModule,
  makeProviders: (instance) => [firebaseServerAppTokenProvider(asGetter(instance.app))],
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminTestInstance>(instance, nest)
});

export const demoApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiContextFixture<FirebaseAdminTestInstance>>) => {
  initDemoApiTestEnvironment();
  return _demoApiContextFactory(buildTests);
};

const _demoApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestDemoApiAppModule,
  makeProviders: (instance) => [firebaseServerAppTokenProvider(asGetter(instance.app))],
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminFunctionTestInstance>(instance, nest)
});

export const demoApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiContextFixture<FirebaseAdminFunctionTestInstance>>) => {
  initDemoApiTestEnvironment();
  return _demoApiFunctionContextFactory(buildTests);
};
