import { Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument } from '@dereekb/demo-firebase';
import { DemoFirestoreCollections, ProfileDocument } from '@dereekb/demo-firebase';
import { authorizedUserContextFactory, AuthorizedUserTestContextFixture, AuthorizedUserTestContextInstance, firebaseAdminFunctionNestContextFactory, FirebaseAdminFunctionNestTestContextFixture, FirebaseAdminFunctionNestTestContextInstance, FirebaseAdminFunctionTestContextInstance, firebaseAdminNestContextFactory, FirebaseAdminNestTestContextFixture, FirebaseAdminNestTestContextInstance, FirebaseAdminTestContextInstance, firebaseServerAppTokenProvider, initFirebaseAdminTestEnvironment, modelTestContextFactory, ModelTestContextFixture, ModelTestContextInstance, setupFirebaseAdminFunctionTestSingleton } from '@dereekb/firebase-server';
import { asGetter, JestBuildTestsWithContextFunction, JestTestContextFixture } from '@dereekb/util';
import { Module } from '@nestjs/common';
import { DemoApiAppModule } from '../app/app.module';
import { initUserOnCreate } from '../app/function/auth/auth.function';

// MARK: Demo Api Testing Fixture
@Module({
  imports: [DemoApiAppModule]
})
export class TestDemoApiAppModule { }

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

export interface DemoApiContext { }

// MARK: Admin
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, JestTestContextFixture<F>, DemoApiContextFixtureInstance<F>> implements DemoApiContext { }

export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> implements DemoApiContext {

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.get(DemoFirestoreCollections);
  }

}

const _demoApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestDemoApiAppModule,
  makeProviders: (instance) => [firebaseServerAppTokenProvider(asGetter(instance.app))],
  makeFixture: (parent) => new DemoApiContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const demoApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiContextFixture<FirebaseAdminTestContextInstance>>) => {
  initDemoApiTestEnvironment();
  return _demoApiContextFactory(buildTests);
};

// MARK: Admin Function
export class DemoApiFunctionContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminFunctionNestTestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiContextFixtureInstance<F>> implements DemoApiContext { }

export class DemoApiFunctionContextFixtureInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance
  > extends FirebaseAdminFunctionNestTestContextInstance<F> implements DemoApiContext {

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.get(DemoFirestoreCollections);
  }

}

const _demoApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestDemoApiAppModule,
  makeProviders: (instance) => [firebaseServerAppTokenProvider(asGetter(instance.app))],
  makeFixture: (parent) => new DemoApiFunctionContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>(instance, nest)
});

export const demoApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiFunctionContextFixture>) => {
  initDemoApiTestEnvironment();
  return _demoApiFunctionContextFactory(buildTests);
};

// MARK: With Users
export class DemoApiAuthorizedUserTestContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends AuthorizedUserTestContextFixture<DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiAuthorizedUserTestContextInstance<F>> { }

export class DemoApiAuthorizedUserTestContextInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends AuthorizedUserTestContextInstance<DemoApiFunctionContextFixtureInstance<F>> {

  get demoApiContext(): DemoApiFunctionContextFixtureInstance<F> {
    return this.testContext;
  }

  get nest() {
    return this.demoApiContext.nest;
  }

  get nestAppPromiseGetter() {
    return this.demoApiContext.nestAppPromiseGetter;
  }

  loadUserProfile(): ProfileDocument {
    return this.nest.get(DemoFirestoreCollections).profileFirestoreCollection.documentAccessor().loadDocumentForPath(this.uid);
  }

}

export interface DemoAuthorizedUserContextParams {
  demoUserLevel?: 'admin' | 'user';
}

export const demoAuthorizedUserContextFactory = (params: DemoAuthorizedUserContextParams) => authorizedUserContextFactory<
  DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
  DemoApiAuthorizedUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiAuthorizedUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>
>({
  makeFixture: (f) => new DemoApiAuthorizedUserTestContextFixture(f),
  makeUserDetails: () => ({ claims: { demoUserLevel: params.demoUserLevel ?? 'user' } }),
  makeInstance: (uid, testInstance) => new DemoApiAuthorizedUserTestContextInstance(uid, testInstance),
  initUser: async (instance) => {
    const userRecord = await instance.loadUserRecord();

    const fn = instance.testContext.wrapCloudFunction(initUserOnCreate(instance.nestAppPromiseGetter));
    await instance.callEventCloudFunction(fn, userRecord);
  }
});

export const demoAuthorizedUserContext = demoAuthorizedUserContextFactory({});
export const demoAuthorizedDemoAdminContext = demoAuthorizedUserContextFactory({ demoUserLevel: 'admin' });

// MARK: With Guestbook
export interface DemoApiGuestbookTestContextParams extends Partial<Guestbook> { }

export class DemoApiGuestbookTestContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends ModelTestContextFixture<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookTestContextInstance<F>> { }

export class DemoApiGuestbookTestContextInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends ModelTestContextInstance<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>> { }

export const demoGuestbookContextFactory = () => modelTestContextFactory<
  Guestbook, GuestbookDocument, DemoApiGuestbookTestContextParams,
  DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
  DemoApiGuestbookTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiGuestbookTestContextFixture<FirebaseAdminFunctionTestContextInstance>
>({
  makeFixture: (f) => new DemoApiGuestbookTestContextFixture(f),
  getCollection: (fi) => fi.demoFirestoreCollections.guestbookFirestoreCollection,
  makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookTestContextInstance(delegate, ref, testInstance),
  initDocument: async (instance, params) => {
    const guestbook = instance.document;

    await guestbook.accessor.set({
      name: params.name ?? 'test',
      active: params.active ?? true,
      locked: params.locked ?? false,
      lockedAt: (params.lockedAt) ?? ((params.locked) ? new Date() : undefined)
    });
  }
});

export const demoGuestbookContext = demoGuestbookContextFactory();

// MARK: Guestbook Entry
export interface DemoApiGuestbookEntryTestContextParams extends Partial<GuestbookEntry> {
  init?: boolean;
  u: DemoApiAuthorizedUserTestContextFixture;
  guestbook: DemoApiGuestbookTestContextFixture;
}

export class DemoApiGuestbookEntryTestContextFixture<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends ModelTestContextFixture<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookEntryTestContextInstance<F>> { }

export class DemoApiGuestbookEntryTestContextInstance<
  F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance,
  > extends ModelTestContextInstance<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>> { }

export const demoGuestbookEntryContextFactory = () => modelTestContextFactory<
  GuestbookEntry, GuestbookEntryDocument, DemoApiGuestbookEntryTestContextParams,
  DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
  DemoApiGuestbookEntryTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
  DemoApiGuestbookEntryTestContextFixture<FirebaseAdminFunctionTestContextInstance>
>({
  makeFixture: (f) => new DemoApiGuestbookEntryTestContextFixture(f),
  getCollection: (fi, params) => fi.demoFirestoreCollections.guestbookEntryCollectionFactory(params.guestbook.document),
  makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookEntryTestContextInstance(delegate, ref, testInstance),
  makeRef: async (collection, params) => {
    return collection.documentAccessor().documentRefForPath(params.u.uid);
  },
  initDocument: async (instance, params) => {
    const guestbookEntry = instance.document;

    if (params.init !== false) {
      await guestbookEntry.accessor.set({
        message: params.message ?? 'test',
        signed: params.signed ?? 'test',
        published: params.published ?? true,
        createdAt: params.createdAt ?? new Date(),
        updatedAt: params.updatedAt ?? new Date()
      });
    }
  }
});

export const demoGuestbookEntryContext = demoGuestbookEntryContextFactory();
