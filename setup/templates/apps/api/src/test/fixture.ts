import { APP_CODE_PREFIXFirestoreCollections, ExampleDocument } from 'FIREBASE_COMPONENTS_NAME';
import { authorizedUserContextFactory, AuthorizedUserTestContextFixture, AuthorizedUserTestContextInstance, firebaseAdminFunctionNestContextFactory, FirebaseAdminFunctionNestTestContextFixture, FirebaseAdminFunctionNestTestContextInstance, FirebaseAdminFunctionTestContextInstance, firebaseAdminNestContextFactory, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, initFirebaseAdminTestEnvironment, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance, setupFirebaseAdminFunctionTestSingleton } from '@dereekb/firebase-server/test';
import { JestBuildTestsWithContextFunction, JestTestContextFixture } from '@dereekb/util/test';
import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiAppModule } from '../app/app.module';
import { initUserOnCreate } from '../app/function/auth/init.user.function';

// MARK: APP_CODE_PREFIX Api Testing Fixture
@Module({
  imports: [APP_CODE_PREFIXApiAppModule]
})
export class TestAPP_CODE_PREFIXApiAppModule { }

export function initAPP_CODE_PREFIXApiTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:FIREBASE_EMULATOR_AUTH_PORT',
      firestore: '0.0.0.0:FIREBASE_EMULATOR_FIRESTORE_PORT',
      storage: '0.0.0.0:FIREBASE_EMULATOR_STORAGE_PORT'
    }
  });
  setupFirebaseAdminFunctionTestSingleton();
}

export interface APP_CODE_PREFIXApiContext { }

// MARK: Admin
export class APP_CODE_PREFIXApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, JestTestContextFixture<F>, APP_CODE_PREFIXApiContextFixtureInstance<F>> implements APP_CODE_PREFIXApiContext { }

export class APP_CODE_PREFIXApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> implements APP_CODE_PREFIXApiContext {

  get APP_CODE_PREFIX_LOWERFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.get(APP_CODE_PREFIXFirestoreCollections);
  }

}

const _APP_CODE_PREFIX_LOWERApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestAPP_CODE_PREFIXApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new APP_CODE_PREFIXApiContextFixture(parent),
  makeInstance: (instance, nest) => new APP_CODE_PREFIXApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const APP_CODE_PREFIX_LOWERApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<APP_CODE_PREFIXApiContextFixture<FirebaseAdminTestContextInstance>>) => {
  initAPP_CODE_PREFIXApiTestEnvironment();
  return _APP_CODE_PREFIX_LOWERApiContextFactory(buildTests);
};

// MARK: Admin Function
export class APP_CODE_PREFIXApiFunctionContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminFunctionNestTestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiContextFixtureInstance<F>> implements APP_CODE_PREFIXApiContext { }

export class APP_CODE_PREFIXApiFunctionContextFixtureInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminFunctionNestTestContextInstance<F> implements APP_CODE_PREFIXApiContext {

  get APP_CODE_PREFIX_LOWERFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.get(APP_CODE_PREFIXFirestoreCollections);
  }

}

const _APP_CODE_PREFIX_LOWERApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestAPP_CODE_PREFIXApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new APP_CODE_PREFIXApiFunctionContextFixture(parent),
  makeInstance: (instance, nest) => new APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>(instance, nest)
});

export const APP_CODE_PREFIX_LOWERApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<APP_CODE_PREFIXApiFunctionContextFixture>) => {
  initAPP_CODE_PREFIXApiTestEnvironment();
  return _APP_CODE_PREFIX_LOWERApiFunctionContextFactory(buildTests);
};

// MARK: With Users
export class APP_CODE_PREFIXApiAuthorizedUserTestContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends AuthorizedUserTestContextFixture<APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<F>> { }

export class APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends AuthorizedUserTestContextInstance<APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {

  get APP_CODE_PREFIX_LOWERApiContext(): APP_CODE_PREFIXApiFunctionContextFixtureInstance<F> {
    return this.testContext;
  }

  get nest() {
    return this.APP_CODE_PREFIX_LOWERApiContext.nest;
  }

  get nestAppPromiseGetter() {
    return this.APP_CODE_PREFIX_LOWERApiContext.nestAppPromiseGetter;
  }

}

export interface APP_CODE_PREFIXAuthorizedUserContextFactoryConfig {
  userLevel?: 'admin' | 'user';
}

export const APP_CODE_PREFIX_LOWERAuthorizedUserContextFactory = (params: APP_CODE_PREFIXAuthorizedUserContextFactoryConfig) => authorizedUserContextFactory<
  APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
  APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
  APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
  APP_CODE_PREFIXApiAuthorizedUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>
>({
  makeFixture: (f) => new APP_CODE_PREFIXApiAuthorizedUserTestContextFixture(f),
  makeUserDetails: () => ({ claims: { APP_CODE_PREFIX_LOWERUserLevel: params.userLevel ?? 'user' } }),
  makeInstance: (uid, testInstance) => new APP_CODE_PREFIXApiAuthorizedUserTestContextInstance(uid, testInstance),
  initUser: async (instance) => {
    const userRecord = await instance.loadUserRecord();
    const fn = instance.testContext.fnWrapper.wrapV1CloudFunction(initUserOnCreate(instance.nestAppPromiseGetter));
    await instance.callEventCloudFunction(fn, userRecord);
  }
});

export const APP_CODE_PREFIX_LOWERAuthorizedUserContext = APP_CODE_PREFIX_LOWERAuthorizedUserContextFactory({});
export const APP_CODE_PREFIX_LOWERAuthorizedUserAdminContext = APP_CODE_PREFIX_LOWERAuthorizedUserContextFactory({ userLevel: 'admin' });
