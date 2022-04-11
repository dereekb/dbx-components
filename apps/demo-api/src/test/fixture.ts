import { authorizedUserContextFactory, AuthorizedUserTestContextFixture, AuthorizedUserTestContextInstance, firebaseAdminFunctionNestContextFactory, FirebaseAdminFunctionTestInstance, firebaseAdminNestContextFactory, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestInstance, FirebaseAdminTestContextInstance, FirebaseAuthUserIdentifier, firebaseServerAppTokenProvider, initFirebaseAdminTestEnvironment, setupFirebaseAdminFunctionTestSingleton } from '@dereekb/firebase-server';
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
export type DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> = FirebaseAdminNestTestContextFixture<F, DemoApiContextFixtureInstance<F>>;
export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestInstance<F> { }

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
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const demoApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiContextFixture<FirebaseAdminTestContextInstance>>) => {
  initDemoApiTestEnvironment();
  return _demoApiContextFactory(buildTests);
};

const _demoApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestDemoApiAppModule,
  makeProviders: (instance) => [firebaseServerAppTokenProvider(asGetter(instance.app))],
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminFunctionTestInstance>(instance, nest)
});

export type DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestInstance = FirebaseAdminFunctionTestInstance> = FirebaseAdminNestTestContextFixture<F, DemoApiContextFixtureInstance<F>>;

export const demoApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiFunctionContextFixture>) => {
  initDemoApiTestEnvironment();
  return _demoApiFunctionContextFactory(buildTests);
};

// MARK: With Users

export class DemoApiAuthorizedUserTestContextFixture extends AuthorizedUserTestContextFixture<DemoApiAuthorizedUserTestContextInstance> { }

export class DemoApiAuthorizedUserTestContextInstance extends AuthorizedUserTestContextInstance { }

export interface DemoAuthorizedUserContextParams {
  demoUserLevel?: 'admin' | 'user';
}

export const demoAuthorizedUserContextFactory = (params: DemoAuthorizedUserContextParams) => authorizedUserContextFactory({
  makeFixture: (f) => new DemoApiAuthorizedUserTestContextFixture(f),
  makeUserDetails: () => ({ claims: { demoUserLevel: params.demoUserLevel ?? 'user' } }),
  makeInstance: (uid, testInstance) => new DemoApiAuthorizedUserTestContextInstance(uid, testInstance)
});

export const demoAuthorizedUserContext = demoAuthorizedUserContextFactory({});
export const demoAuthorizedDemoAdminContext = demoAuthorizedUserContextFactory({ demoUserLevel: 'admin' });
