import { Guestbook, GuestbookDocument, GuestbookEntry, GuestbookEntryDocument, DemoFirestoreCollections, ProfileDocument, GuestbookEntryFirestoreCollection, Profile, ProfileFirestoreCollection, InsertGuestbookEntryParams } from '@dereekb/demo-firebase';
import {
  authorizedUserContextFactory,
  AuthorizedUserTestContextFixture,
  AuthorizedUserTestContextInstance,
  firebaseAdminFunctionNestContextFactory,
  FirebaseAdminFunctionNestTestContextFixture,
  FirebaseAdminFunctionNestTestContextInstance,
  FirebaseAdminFunctionTestContextInstance,
  firebaseAdminNestContextFactory,
  FirebaseAdminNestTestContextFixture,
  FirebaseAdminNestTestContextInstance,
  FirebaseAdminTestContextInstance,
  initFirebaseAdminTestEnvironment,
  modelTestContextFactory,
  ModelTestContextFixture,
  ModelTestContextInstance,
  setupFirebaseAdminFunctionTestSingleton
} from '@dereekb/firebase-server/test';
import { JestBuildTestsWithContextFunction, JestTestContextFixture } from '@dereekb/util/test';
import { Module } from '@nestjs/common';
import { DemoApiAppModule } from '../app/app.module';
import { initUserOnCreate } from '../app/function/auth/init.user.function';
import { DemoApiNestContext } from '../app/function/function';
import {
  CleanupSentNotificationsParams,
  FirestoreCollection,
  FirestoreModelKey,
  InitializeAllApplicableNotificationBoxesParams,
  InitializeNotificationModelParams,
  NotificationBox,
  NotificationBoxDocument,
  NotificationBoxFirestoreCollection,
  Notification,
  NotificationDocument,
  NotificationWeek,
  NotificationWeekDocument,
  SendNotificationParams,
  getDocumentSnapshotDataPairs,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  UpdateNotificationBoxRecipientParams,
  NotificationSummary,
  NotificationSummaryDocument,
  NotificationSummaryFirestoreCollection,
  NotificationUser,
  NotificationUserDocument,
  NotificationUserFirestoreCollection,
  CreateNotificationTemplate,
  createNotificationDocument,
  UpdateNotificationUserParams
} from '@dereekb/firebase';
import { YearWeekCode, yearWeekCode } from '@dereekb/date';
import { objectHasKeys, type Maybe, AsyncGetterOrValue, getValueFromGetter } from '@dereekb/util';
import { NotificationInitServerActions, NotificationSendService, NotificationServerActions } from '@dereekb/firebase-server/model';
import { DemoApiAuthService, DemoFirebaseServerActionsContext, DemoFirebaseServerActionsContextWithNotificationServices, GuestbookServerActions, ProfileServerActions } from '../app/common';
import { MailgunService } from '@dereekb/nestjs/mailgun';

// MARK: Demo Api Testing Fixture
@Module({
  imports: [DemoApiAppModule]
})
export class TestDemoApiAppModule {}

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

export interface DemoApiContext {
  get demoFirestoreCollections(): DemoFirestoreCollections;
  get authService(): DemoApiAuthService;
  get mailgunService(): MailgunService;
  get notificationServerActions(): NotificationServerActions;
  get notificationInitServerActions(): NotificationInitServerActions;
  get notificationSendService(): NotificationSendService;
}

// MARK: Admin
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, JestTestContextFixture<F>, DemoApiContextFixtureInstance<F>> implements DemoApiContext {
  get serverActionsContext() {
    return this.instance.serverActionsContext;
  }

  get serverActionsContextWithNotificationServices() {
    return this.instance.serverActionsContextWithNotificationServices;
  }

  get demoFirestoreCollections() {
    return this.instance.demoFirestoreCollections;
  }

  get mailgunService() {
    return this.instance.mailgunService;
  }

  get authService() {
    return this.instance.authService;
  }

  get notificationServerActions() {
    return this.instance.notificationServerActions;
  }

  get notificationInitServerActions() {
    return this.instance.notificationInitServerActions;
  }

  get notificationSendService() {
    return this.instance.notificationSendService;
  }

  get profileServerActions() {
    return this.instance.profileServerActions;
  }

  get guestbookServerActions() {
    return this.instance.guestbookServerActions;
  }
}

export class DemoApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> implements DemoApiContext {
  get serverActionsContext() {
    return this.get(DemoFirebaseServerActionsContext);
  }

  get serverActionsContextWithNotificationServices() {
    return this.get(DemoFirebaseServerActionsContextWithNotificationServices);
  }

  get apiNestContext(): DemoApiNestContext {
    return new DemoApiNestContext(this.nest);
  }

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.get(DemoFirestoreCollections);
  }

  get mailgunService() {
    return this.get(MailgunService);
  }

  get authService() {
    return this.get(DemoApiAuthService);
  }

  get notificationServerActions() {
    return this.get(NotificationServerActions);
  }

  get notificationInitServerActions() {
    return this.get(NotificationInitServerActions);
  }

  get notificationSendService() {
    return this.get(NotificationSendService);
  }

  get profileServerActions() {
    return this.get(ProfileServerActions);
  }

  get guestbookServerActions() {
    return this.get(GuestbookServerActions);
  }
}

const _demoApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestDemoApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new DemoApiContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const demoApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiContextFixture>) => {
  initDemoApiTestEnvironment();
  return _demoApiContextFactory(buildTests as any);
};

// MARK: Admin Function
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminFunctionNestTestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiContextFixtureInstance<F>> implements DemoApiContext {
  get serverActionsContext() {
    return this.instance.serverActionsContext;
  }

  get serverActionsContextWithNotificationServices() {
    return this.instance.serverActionsContextWithNotificationServices;
  }

  get demoFirestoreCollections() {
    return this.instance.demoFirestoreCollections;
  }

  get mailgunService() {
    return this.instance.mailgunService;
  }

  get authService() {
    return this.instance.authService;
  }

  get notificationServerActions() {
    return this.instance.notificationServerActions;
  }

  get notificationSendService() {
    return this.instance.notificationSendService;
  }

  get notificationInitServerActions() {
    return this.instance.notificationInitServerActions;
  }

  get profileServerActions() {
    return this.instance.profileServerActions;
  }

  get guestbookServerActions() {
    return this.instance.guestbookServerActions;
  }
}

export class DemoApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminFunctionNestTestContextInstance<F> implements DemoApiContext {
  get serverActionsContext() {
    return this.get(DemoFirebaseServerActionsContext);
  }

  get serverActionsContextWithNotificationServices() {
    return this.get(DemoFirebaseServerActionsContextWithNotificationServices);
  }

  get apiNestContext(): DemoApiNestContext {
    return new DemoApiNestContext(this.nest);
  }

  get demoFirestoreCollections(): DemoFirestoreCollections {
    return this.get(DemoFirestoreCollections);
  }

  get mailgunService() {
    return this.get(MailgunService);
  }

  get authService() {
    return this.get(DemoApiAuthService);
  }

  get notificationServerActions() {
    return this.get(NotificationServerActions);
  }

  get notificationInitServerActions() {
    return this.get(NotificationInitServerActions);
  }

  get notificationSendService() {
    return this.get(NotificationSendService);
  }

  get profileServerActions() {
    return this.get(ProfileServerActions);
  }

  get guestbookServerActions() {
    return this.get(GuestbookServerActions);
  }
}

const _demoApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestDemoApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new DemoApiFunctionContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>(instance, nest)
});

export const demoApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<DemoApiFunctionContextFixture>) => {
  initDemoApiTestEnvironment();
  return _demoApiFunctionContextFactory(buildTests as any);
};

// MARK: With Users
export class DemoApiAuthorizedUserTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends AuthorizedUserTestContextFixture<DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiAuthorizedUserTestContextInstance<F>> {}

export class DemoApiAuthorizedUserTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends AuthorizedUserTestContextInstance<DemoApiFunctionContextFixtureInstance<F>> {
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
    return this.nest.get(DemoFirestoreCollections).profileCollection.documentAccessor().loadDocumentForId(this.uid);
  }
}

export interface DemoAuthorizedUserContextFactoryConfig {
  /**
   * Onboarded state. Defaults to true.
   */
  onboarded?: boolean;
  demoUserLevel?: 'admin' | 'user';
}

export const demoAuthorizedUserContextFactory = (params: DemoAuthorizedUserContextFactoryConfig) =>
  authorizedUserContextFactory<DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiAuthorizedUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiAuthorizedUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiAuthorizedUserTestContextFixture(f),
    makeUserDetails: () => ({ claims: { o: params.onboarded !== false ? 1 : 0, a: params.demoUserLevel === 'admin' ? 1 : 0, demoUserLevel: params.demoUserLevel ?? 'user' } }),
    makeInstance: (uid, testInstance) => new DemoApiAuthorizedUserTestContextInstance(uid, testInstance),
    initUser: async (instance) => {
      const userRecord = await instance.loadUserRecord();
      const fn = instance.testContext.fnWrapper.wrapV1CloudFunction(initUserOnCreate(instance.nestAppPromiseGetter));
      await instance.callEventCloudFunction(fn, userRecord);
    }
  });

export const demoAuthorizedUserContext = demoAuthorizedUserContextFactory({});
export const demoAuthorizedUserAdminContext = demoAuthorizedUserContextFactory({ demoUserLevel: 'admin' });

// MARK: With Profile
export interface DemoApiProfileTestContextParams {
  u: DemoApiAuthorizedUserTestContextFixture;
}

export class DemoApiProfileTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiProfileTestContextInstance<F>> {}

export class DemoApiProfileTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoProfileContextFactory = () =>
  modelTestContextFactory<Profile, ProfileDocument, DemoApiProfileTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiProfileTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiProfileTestContextFixture<FirebaseAdminFunctionTestContextInstance>, ProfileFirestoreCollection>({
    makeFixture: (f) => new DemoApiProfileTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.profileCollection,
    makeRef: async (collection: FirestoreCollection<Profile, ProfileDocument>, params, p) => {
      return collection.documentAccessor().documentRefForId(params.u.uid);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiProfileTestContextInstance(delegate, ref, testInstance)
  });

export const demoProfileContext = demoProfileContextFactory();

// MARK: With Guestbook
export type DemoApiGuestbookTestContextParams = Partial<Guestbook>;

export class DemoApiGuestbookTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookTestContextInstance<F>> {}

export class DemoApiGuestbookTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoGuestbookContextFactory = () =>
  modelTestContextFactory<Guestbook, GuestbookDocument, DemoApiGuestbookTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiGuestbookTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.guestbookCollection,
    collectionForDocument: (fi, doc) => {
      return fi.demoFirestoreCollections.guestbookCollection;
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookTestContextInstance(delegate, ref, testInstance),
    initDocument: async (instance, params) => {
      const guestbook = instance.document;

      await guestbook.accessor.set({
        name: params.name ?? 'test',
        published: params.published ?? true,
        locked: params.locked ?? false,
        lockedAt: params.lockedAt ?? (params.locked ? new Date() : undefined)
      });
    }
  });

export const demoGuestbookContext = demoGuestbookContextFactory();

// MARK: Guestbook Entry
export interface DemoApiGuestbookEntryTestContextParams extends Partial<GuestbookEntry> {
  init?: boolean;
  u: DemoApiAuthorizedUserTestContextFixture;
  g: DemoApiGuestbookTestContextFixture;
}

export class DemoApiGuestbookEntryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiGuestbookEntryTestContextInstance<F>> {
  async init(params?: Maybe<Partial<Omit<InsertGuestbookEntryParams, 'guestbook'>>>) {
    return this.instance.init(params);
  }

  async createOrUpdateEntry(update: Omit<InsertGuestbookEntryParams, 'guestbook'>) {
    return this.instance.createOrUpdateEntry(update);
  }

  async like() {
    return this.instance.like();
  }
}

export class DemoApiGuestbookEntryTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<GuestbookEntry, GuestbookEntryDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async init(params?: Maybe<Partial<Omit<InsertGuestbookEntryParams, 'guestbook'>>>) {
    await this.createOrUpdateEntry({
      message: params?.message ?? 'test',
      signed: params?.signed ?? 'test',
      published: params?.published ?? true
    });
  }

  async createOrUpdateEntry(update: Omit<InsertGuestbookEntryParams, 'guestbook'>) {
    const updateInstance = await this.testContext.guestbookServerActions.insertGuestbookEntry({
      ...update,
      guestbook: this.document.parent.id
    });

    await updateInstance(this.document);
  }

  async like() {
    const likeInstance = await this.testContext.guestbookServerActions.likeGuestbookEntry({
      key: this.documentKey
    });

    return likeInstance(this.document);
  }
}

export const demoGuestbookEntryContextFactory = () =>
  modelTestContextFactory<GuestbookEntry, GuestbookEntryDocument, DemoApiGuestbookEntryTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookEntryTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiGuestbookEntryTestContextFixture<FirebaseAdminFunctionTestContextInstance>, GuestbookEntryFirestoreCollection>({
    makeFixture: (f) => new DemoApiGuestbookEntryTestContextFixture(f),
    getCollection: (fi, params) => fi.demoFirestoreCollections.guestbookEntryCollectionFactory(params.g.document),
    collectionForDocument: (fi, doc) => {
      const parent = fi.demoFirestoreCollections.guestbookCollection.documentAccessor().loadDocument(doc.parent);
      return fi.demoFirestoreCollections.guestbookEntryCollectionFactory(parent);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookEntryTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => {
      return collection.documentAccessor().documentRefForId(params.u.uid);
    },
    initDocument: async (instance, params) => {
      const guestbookEntry = instance.document;
      const exists = await instance.document.exists();

      if (params.init !== false && !exists) {
        if (!exists) {
          await instance.init(params);
        }
      } else if (exists && objectHasKeys(params, ['message', 'signed', 'published'], 'any')) {
        await instance.createOrUpdateEntry(params);
      }

      if (params.createdAt || params.updatedAt) {
        await guestbookEntry.update({
          createdAt: params.createdAt ?? new Date(),
          updatedAt: params.updatedAt ?? new Date()
        });
      }
    }
  });

export const demoGuestbookEntryContext = demoGuestbookEntryContextFactory();

// MARK: NotificationSummary
export interface DemoApiNotificationUserTestContextParams {
  u: DemoApiAuthorizedUserTestContextFixture;
  init?: boolean;
}

export class DemoApiNotificationUserTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationUser, NotificationUserDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiNotificationUserTestContextInstance<F>> {
  async updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>) {
    return this.instance.updateNotificationUser(params);
  }

  async resyncNotificationUser() {
    return this.instance.resyncNotificationUser();
  }
}

export class DemoApiNotificationUserTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationUser, NotificationUserDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>) {
    const update = await this.testContext.notificationServerActions.updateNotificationUser({
      ...params,
      key: this.documentKey
    });

    await update(this.document);
  }

  async resyncNotificationUser() {
    const resyncUser = await this.testContext.notificationServerActions.resyncNotificationUser({
      key: this.documentKey
    });

    await resyncUser(this.document);
  }
}

export const demoNotificationUserContextFactory = () =>
  modelTestContextFactory<NotificationUser, NotificationUserDocument, DemoApiNotificationUserTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationUserFirestoreCollection>({
    makeFixture: (f) => new DemoApiNotificationUserTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationUserCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationUserTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      return collection.documentAccessor().loadDocumentForId(params.u.uid).documentRef;
    },
    initDocument: async (instance, params) => {
      const p = instance.testContext;

      if (params.init !== false) {
        const exists = await instance.document.exists();

        // initialize
        if (!exists) {
          const createNotificationUser = await p.notificationServerActions.createNotificationUser({
            uid: params.u.uid
          });

          await createNotificationUser();
        }
      }
    }
  });

export const demoNotificationUserContext = demoNotificationUserContextFactory();

// MARK: NotificationSummary
export interface DemoApiNotificationSummaryTestContextParams {
  for: ModelTestContextFixture<any, any, any, any, any>;
  ownershipKey?: FirestoreModelKey | ModelTestContextFixture<any, any, any, any, any>;
  createIfNeeded?: boolean;
  initIfNeeded?: boolean;
}

export class DemoApiNotificationSummaryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationSummary, NotificationSummaryDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiNotificationSummaryTestContextInstance<F>> {}

export class DemoApiNotificationSummaryTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationSummary, NotificationSummaryDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoNotificationSummaryContextFactory = () =>
  modelTestContextFactory<NotificationSummary, NotificationSummaryDocument, DemoApiNotificationSummaryTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationSummaryTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationSummaryTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationSummaryFirestoreCollection>({
    makeFixture: (f) => new DemoApiNotificationSummaryTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationSummaryCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationSummaryTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const flatModelKey = params.for.documentTwoWayFlatKey;
      return collection.documentAccessor().loadDocumentForId(flatModelKey).documentRef;
    },
    initDocument: async (instance, params) => {
      const p = instance.testContext;

      if (params.createIfNeeded === true) {
        const exists = await instance.document.exists();

        // initialize
        if (!exists) {
          const createNotificationSummary = await p.notificationServerActions.createNotificationSummary({
            model: params.for.documentKey
          });

          await createNotificationSummary();
        }

        // initialize
        if (params.createIfNeeded === true || params.initIfNeeded === true) {
          const initNotificationSummary = await p.notificationInitServerActions.initializeNotificationSummary({
            key: instance.documentKey
          });

          await initNotificationSummary(instance.document);
        }
      }
    }
  });

export const demoNotificationSummaryContext = demoNotificationSummaryContextFactory();

// MARK: NotificationBox
export interface DemoApiNotificationBoxTestContextParams {
  for: ModelTestContextFixture<any, any, any, any, any>;
  ownershipKey?: FirestoreModelKey | ModelTestContextFixture<any, any, any, any, any>;
  /**
   * Whether or not to initialize the NotificationBox. Defaults to false.
   */
  createIfNeeded?: boolean;
  /**
   * Whether or not to create and initialize. Defaults to false.
   */
  initIfNeeded?: boolean;
}

export class DemoApiNotificationBoxTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationBox, NotificationBoxDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiNotificationBoxTestContextInstance<F>> {
  allNotificationsForNotificationBoxQuery() {
    return this.instance.allNotificationsForNotificationBoxQuery();
  }

  async initializeAllApplicableNotificationBoxes() {
    return this.instance.initializeAllApplicableNotificationBoxes();
  }

  async loadAllNotificationsForNotificationBox() {
    return this.instance.loadAllNotificationsForNotificationBox();
  }

  async loadAllNotificationWeeksForNotificationBox() {
    return this.instance.loadAllNotificationWeeksForNotificationBox();
  }

  async deleteAllNotificationsForNotificationBox() {
    return this.instance.deleteAllNotificationsForNotificationBox();
  }

  async initializeNotificationBox(params?: Omit<InitializeNotificationModelParams, 'key'>) {
    return this.instance.initializeNotificationBox(params);
  }

  async updateRecipient(params: Omit<UpdateNotificationBoxRecipientParams, 'key'>) {
    return this.instance.updateRecipient(params);
  }
}

export class DemoApiNotificationBoxTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationBox, NotificationBoxDocument, DemoApiFunctionContextFixtureInstance<F>> {
  allNotificationsForNotificationBoxQuery() {
    const query = this.testContext.demoFirestoreCollections.notificationCollectionFactory(this.document).queryDocument();
    return query;
  }

  allNotificationWeeksForNotificationBoxQuery() {
    const query = this.testContext.demoFirestoreCollections.notificationWeekCollectionFactory(this.document).queryDocument();
    return query;
  }

  async initializeAllApplicableNotificationBoxes() {
    const params: InitializeAllApplicableNotificationBoxesParams = {};
    const initializeAllApplicableNotificationBoxes = await this.testContext.notificationInitServerActions.initializeAllApplicableNotificationBoxes(params);
    return initializeAllApplicableNotificationBoxes();
  }

  async loadAllNotificationsForNotificationBox() {
    const query = this.allNotificationsForNotificationBoxQuery();
    const results = await query.getDocs();
    return getDocumentSnapshotDataPairs(results);
  }

  async loadAllNotificationWeeksForNotificationBox() {
    const query = this.allNotificationWeeksForNotificationBoxQuery();
    const results = await query.getDocs();
    return getDocumentSnapshotDataPairs(results);
  }

  async deleteAllNotificationsForNotificationBox() {
    const existingNotifications = await this.loadAllNotificationsForNotificationBox();
    await Promise.all(existingNotifications.map((x) => x.document.accessor.delete()));
  }

  async initializeNotificationBox(params?: Omit<InitializeNotificationModelParams, 'key'>) {
    const initNotificationBox = await this.testContext.notificationInitServerActions.initializeNotificationBox({ key: this.documentKey, ...params });
    return initNotificationBox(this.document);
  }

  async updateRecipient(params: Omit<UpdateNotificationBoxRecipientParams, 'key'>) {
    const updateRecipient = await this.testContext.notificationServerActions.updateNotificationBoxRecipient({
      key: this.documentKey,
      ...params
    });

    await updateRecipient(this.document);
  }
}

export const demoNotificationBoxContextFactory = () =>
  modelTestContextFactory<NotificationBox, NotificationBoxDocument, DemoApiNotificationBoxTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationBoxTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationBoxTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationBoxFirestoreCollection>({
    makeFixture: (f) => new DemoApiNotificationBoxTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationBoxCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationBoxTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const flatModelKey = params.for.documentTwoWayFlatKey;
      return collection.documentAccessor().loadDocumentForId(flatModelKey).documentRef;
    },
    initDocument: async (instance, params) => {
      const p = instance.testContext;

      if (params.createIfNeeded === true || params.initIfNeeded === true) {
        const exists = await instance.document.exists();

        // create if it doesn't exist
        if (!exists) {
          const model = inferKeyFromTwoWayFlatFirestoreModelKey(instance.documentId);
          const createNotificationBox = await p.notificationServerActions.createNotificationBox({
            model
          });

          await createNotificationBox();
        }

        // initialize
        if (params.initIfNeeded === true) {
          const initNotificationBox = await p.notificationInitServerActions.initializeNotificationBox({
            key: instance.documentKey
          });

          await initNotificationBox(instance.document);
        }
      }
    }
  });

export const demoNotificationBoxContext = demoNotificationBoxContextFactory();

// MARK: Notification
export interface DemoApiNotificationTestContextParams {
  template: AsyncGetterOrValue<CreateNotificationTemplate>;
}

export class DemoApiNotificationTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Notification, NotificationDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiNotificationTestContextInstance<F>> {
  async sendAllQueuedNotifications() {
    return this.instance.sendAllQueuedNotifications();
  }

  async cleanupAllSentNotifications() {
    return this.instance.cleanupAllSentNotifications();
  }

  async sendNotification(params?: Maybe<Omit<SendNotificationParams, 'key'>>) {
    return this.instance.sendNotification(params);
  }
}

export class DemoApiNotificationTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Notification, NotificationDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Sends the notification.
   */
  async sendAllQueuedNotifications() {
    const sendAllQueuedNotifications = await this.testContext.notificationServerActions.sendQueuedNotifications({});
    return sendAllQueuedNotifications();
  }

  /**
   * Cleanup all sent notifications
   */
  async cleanupAllSentNotifications() {
    const params: CleanupSentNotificationsParams = {};
    const cleanupSentNotifications = await this.testContext.notificationServerActions.cleanupSentNotifications(params);
    return cleanupSentNotifications();
  }

  /**
   * Sends the notification.
   */
  async sendNotification(params?: Maybe<Omit<SendNotificationParams, 'key'>>) {
    const sendNotification = await this.testContext.notificationServerActions.sendNotification({ ...params, key: this.documentKey });
    return sendNotification(this.document);
  }
}

export const demoNotificationContextFactory = () =>
  modelTestContextFactory<Notification, NotificationDocument, DemoApiNotificationTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiNotificationTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationCollectionGroup,
    collectionForDocument: (fi, doc) => {
      const parentDocument = fi.demoFirestoreCollections.notificationBoxCollection.documentAccessor().loadDocument(doc.parent);
      return fi.demoFirestoreCollections.notificationCollectionFactory(parentDocument);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const template = await getValueFromGetter(params.template);

      if (!template) {
        throw new Error('Template is required, or provide an existing doc.');
      }

      const result = await createNotificationDocument({
        template
      });

      return result.notificationDocument.documentRef;
    }
  });

export const demoNotificationContext = demoNotificationContextFactory();

// MARK: NotificationWeek
export interface DemoApiNotificationWeekTestContextParams {
  nb: DemoApiNotificationBoxTestContextFixture;
  /**
   * Week to target. If not set, defaults to today.
   */
  week?: YearWeekCode;
  /**
   * Whether or not to initialize the week. Defaults to true.
   */
  init?: boolean;
}

export class DemoApiNotificationWeekTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationWeek, NotificationWeekDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiNotificationWeekTestContextInstance<F>> {}

export class DemoApiNotificationWeekTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationWeek, NotificationWeekDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoNotificationWeekContextFactory = () =>
  modelTestContextFactory<NotificationWeek, NotificationWeekDocument, DemoApiNotificationWeekTestContextParams, DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationWeekTestContextInstance<FirebaseAdminFunctionTestContextInstance>, DemoApiNotificationWeekTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new DemoApiNotificationWeekTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationWeekCollectionGroup,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationWeekTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const week = params.week ?? yearWeekCode(new Date());
      const notificationWeekDocument = p.demoFirestoreCollections.notificationWeekCollectionFactory(params.nb.document).documentAccessor().loadDocumentForId(`${week}`);
      return notificationWeekDocument.documentRef;
    },
    initDocument: async (instance, params) => {
      if (params.init !== false) {
        const exists = await instance.document.exists();

        if (!exists) {
          await instance.document.create({
            w: Number(instance.documentId),
            n: []
          });
        }
      }
    }
  });

export const demoNotificationWeekContext = demoNotificationWeekContextFactory();
