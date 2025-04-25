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
import { APP_CODE_PREFIXApiAppModule } from '../app/app.module';
import { initUserOnCreate } from '../app/function/auth/init.user.function';
import { APP_CODE_PREFIXApiNestContext } from '../app/function/function';
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
import {  APP_CODE_PREFIXFirestoreCollections, ProfileDocument, Profile, ProfileFirestoreCollection,  } from 'FIREBASE_COMPONENTS_NAME';
import { YearWeekCode, yearWeekCode } from '@dereekb/date';
import { objectHasKeys, type Maybe, AsyncGetterOrValue, getValueFromGetter } from '@dereekb/util';
import { NotificationInitServerActions, NotificationSendService, NotificationServerActions } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXApiAuthService, APP_CODE_PREFIXFirebaseServerActionsContext, APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices, ProfileServerActions } from '../app/common';
import { MailgunService } from '@dereekb/nestjs/mailgun';

// MARK: APP_CODE_PREFIX Api Testing Fixture
@Module({
  imports: [APP_CODE_PREFIXApiAppModule]
})
export class TestAPP_CODE_PREFIXApiAppModule {}

export function initAPP_CODE_PREFIXApiTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:9903',
      firestore: '0.0.0.0:9904',
      storage: '0.0.0.0:9906'
    }
  });
  setupFirebaseAdminFunctionTestSingleton();
}

export interface APP_CODE_PREFIXApiContext {
  get APP_CODE_PREFIX_CAMELFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections;
  get authService(): APP_CODE_PREFIXApiAuthService;
  get mailgunService(): MailgunService;
  get notificationServerActions(): NotificationServerActions;
  get notificationInitServerActions(): NotificationInitServerActions;
  get notificationSendService(): NotificationSendService;
}

// MARK: Admin
export class APP_CODE_PREFIXApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, JestTestContextFixture<F>, APP_CODE_PREFIXApiContextFixtureInstance<F>> implements APP_CODE_PREFIXApiContext {
  get serverActionsContext() {
    return this.instance.serverActionsContext;
  }

  get serverActionsContextWithNotificationServices() {
    return this.instance.serverActionsContextWithNotificationServices;
  }

  get APP_CODE_PREFIX_CAMELFirestoreCollections() {
    return this.instance.APP_CODE_PREFIX_CAMELFirestoreCollections;
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

}

export class APP_CODE_PREFIXApiContextFixtureInstance<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextInstance<F> implements APP_CODE_PREFIXApiContext {
  get serverActionsContext() {
    return this.get(APP_CODE_PREFIXFirebaseServerActionsContext);
  }

  get serverActionsContextWithNotificationServices() {
    return this.get(APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices);
  }

  get apiNestContext(): APP_CODE_PREFIXApiNestContext {
    return new APP_CODE_PREFIXApiNestContext(this.nest);
  }

  get APP_CODE_PREFIX_CAMELFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.get(APP_CODE_PREFIXFirestoreCollections);
  }

  get mailgunService() {
    return this.get(MailgunService);
  }

  get authService() {
    return this.get(APP_CODE_PREFIXApiAuthService);
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

}

const _APP_CODE_PREFIX_CAMELApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestAPP_CODE_PREFIXApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new APP_CODE_PREFIXApiContextFixture(parent),
  makeInstance: (instance, nest) => new APP_CODE_PREFIXApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const APP_CODE_PREFIX_CAMELApiContextFactory = (buildTests: JestBuildTestsWithContextFunction<APP_CODE_PREFIXApiContextFixture>) => {
  initAPP_CODE_PREFIXApiTestEnvironment();
  return _APP_CODE_PREFIX_CAMELApiContextFactory(buildTests as any);
};

// MARK: Admin Function
export class APP_CODE_PREFIXApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminFunctionNestTestContextFixture<FirebaseAdminFunctionTestContextInstance, JestTestContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiContextFixtureInstance<F>> implements APP_CODE_PREFIXApiContext {
  get serverActionsContext() {
    return this.instance.serverActionsContext;
  }

  get serverActionsContextWithNotificationServices() {
    return this.instance.serverActionsContextWithNotificationServices;
  }

  get APP_CODE_PREFIX_CAMELFirestoreCollections() {
    return this.instance.APP_CODE_PREFIX_CAMELFirestoreCollections;
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

}

export class APP_CODE_PREFIXApiFunctionContextFixtureInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends FirebaseAdminFunctionNestTestContextInstance<F> implements APP_CODE_PREFIXApiContext {
  get serverActionsContext() {
    return this.get(APP_CODE_PREFIXFirebaseServerActionsContext);
  }

  get serverActionsContextWithNotificationServices() {
    return this.get(APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices);
  }

  get apiNestContext(): APP_CODE_PREFIXApiNestContext {
    return new APP_CODE_PREFIXApiNestContext(this.nest);
  }

  get APP_CODE_PREFIX_CAMELFirestoreCollections(): APP_CODE_PREFIXFirestoreCollections {
    return this.get(APP_CODE_PREFIXFirestoreCollections);
  }

  get mailgunService() {
    return this.get(MailgunService);
  }

  get authService() {
    return this.get(APP_CODE_PREFIXApiAuthService);
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

}

const _APP_CODE_PREFIX_CAMELApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestAPP_CODE_PREFIXApiAppModule,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new APP_CODE_PREFIXApiFunctionContextFixture(parent),
  makeInstance: (instance, nest) => new APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>(instance, nest)
});

export const APP_CODE_PREFIX_CAMELApiFunctionContextFactory = (buildTests: JestBuildTestsWithContextFunction<APP_CODE_PREFIXApiFunctionContextFixture>) => {
  initAPP_CODE_PREFIXApiTestEnvironment();
  return _APP_CODE_PREFIX_CAMELApiFunctionContextFactory(buildTests as any);
};

// MARK: With Users
export class APP_CODE_PREFIXApiAuthorizedUserTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends AuthorizedUserTestContextFixture<APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<F>> {}

export class APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends AuthorizedUserTestContextInstance<APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {
  get APP_CODE_PREFIX_CAMELApiContext(): APP_CODE_PREFIXApiFunctionContextFixtureInstance<F> {
    return this.testContext;
  }

  get nest() {
    return this.APP_CODE_PREFIX_CAMELApiContext.nest;
  }

  get nestAppPromiseGetter() {
    return this.APP_CODE_PREFIX_CAMELApiContext.nestAppPromiseGetter;
  }

  loadUserProfile(): ProfileDocument {
    return this.nest.get(APP_CODE_PREFIXFirestoreCollections).profileCollection.documentAccessor().loadDocumentForId(this.uid);
  }
}

export interface APP_CODE_PREFIX_CAMELAuthorizedUserContextFactoryConfig {
  /**
   * Onboarded state. Defaults to true.
   */
  onboarded?: boolean;
  APP_CODE_PREFIX_CAMELUserLevel?: 'admin' | 'user';
}

export const APP_CODE_PREFIX_CAMELAuthorizedUserContextFactory = (params: APP_CODE_PREFIX_CAMELAuthorizedUserContextFactoryConfig) =>
  authorizedUserContextFactory<APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiAuthorizedUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiAuthorizedUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new APP_CODE_PREFIXApiAuthorizedUserTestContextFixture(f),
    makeUserDetails: () => ({ claims: { o: params.onboarded !== false ? 1 : 0, a: params.APP_CODE_PREFIX_CAMELUserLevel === 'admin' ? 1 : 0, APP_CODE_PREFIX_CAMELUserLevel: params.APP_CODE_PREFIX_CAMELUserLevel ?? 'user' } }),
    makeInstance: (uid, testInstance) => new APP_CODE_PREFIXApiAuthorizedUserTestContextInstance(uid, testInstance),
    initUser: async (instance) => {
      const userRecord = await instance.loadUserRecord();
      const fn = instance.testContext.fnWrapper.wrapCloudFunction(initUserOnCreate(instance.nestAppPromiseGetter));
      await instance.callEventCloudFunction(fn, userRecord);
    }
  });

export const APP_CODE_PREFIX_CAMELAuthorizedUserContext = APP_CODE_PREFIX_CAMELAuthorizedUserContextFactory({});
export const APP_CODE_PREFIX_CAMELAuthorizedUserAdminContext = APP_CODE_PREFIX_CAMELAuthorizedUserContextFactory({ APP_CODE_PREFIX_CAMELUserLevel: 'admin' });

// MARK: With Profile
export interface APP_CODE_PREFIXApiProfileTestContextParams {
  u: APP_CODE_PREFIXApiAuthorizedUserTestContextFixture;
}

export class APP_CODE_PREFIXApiProfileTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Profile, ProfileDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiProfileTestContextInstance<F>> {}

export class APP_CODE_PREFIXApiProfileTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Profile, ProfileDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {}

export const APP_CODE_PREFIX_CAMELProfileContextFactory = () =>
  modelTestContextFactory<Profile, ProfileDocument, APP_CODE_PREFIXApiProfileTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiProfileTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiProfileTestContextFixture<FirebaseAdminFunctionTestContextInstance>, ProfileFirestoreCollection>({
    makeFixture: (f) => new APP_CODE_PREFIXApiProfileTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.profileCollection,
    makeRef: async (collection: FirestoreCollection<Profile, ProfileDocument>, params, p) => {
      return collection.documentAccessor().documentRefForId(params.u.uid);
    },
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiProfileTestContextInstance(delegate, ref, testInstance)
  });

export const APP_CODE_PREFIX_CAMELProfileContext = APP_CODE_PREFIX_CAMELProfileContextFactory();

// MARK: NotificationSummary
export interface APP_CODE_PREFIXApiNotificationUserTestContextParams {
  u: APP_CODE_PREFIXApiAuthorizedUserTestContextFixture;
  init?: boolean;
}

export class APP_CODE_PREFIXApiNotificationUserTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationUser, NotificationUserDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiNotificationUserTestContextInstance<F>> {
  async updateNotificationUser(params: Omit<UpdateNotificationUserParams, 'key'>) {
    return this.instance.updateNotificationUser(params);
  }

  async resyncNotificationUser() {
    return this.instance.resyncNotificationUser();
  }
}

export class APP_CODE_PREFIXApiNotificationUserTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationUser, NotificationUserDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {
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

export const APP_CODE_PREFIX_CAMELNotificationUserContextFactory = () =>
  modelTestContextFactory<NotificationUser, NotificationUserDocument, APP_CODE_PREFIXApiNotificationUserTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationUserFirestoreCollection>({
    makeFixture: (f) => new APP_CODE_PREFIXApiNotificationUserTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationUserCollection,
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiNotificationUserTestContextInstance(delegate, ref, testInstance),
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

export const APP_CODE_PREFIX_CAMELNotificationUserContext = APP_CODE_PREFIX_CAMELNotificationUserContextFactory();

// MARK: NotificationSummary
export interface APP_CODE_PREFIXApiNotificationSummaryTestContextParams {
  for: ModelTestContextFixture<any, any, any, any, any>;
  ownershipKey?: FirestoreModelKey | ModelTestContextFixture<any, any, any, any, any>;
  createIfNeeded?: boolean;
  initIfNeeded?: boolean;
}

export class APP_CODE_PREFIXApiNotificationSummaryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationSummary, NotificationSummaryDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiNotificationSummaryTestContextInstance<F>> {}

export class APP_CODE_PREFIXApiNotificationSummaryTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationSummary, NotificationSummaryDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {}

export const APP_CODE_PREFIX_CAMELNotificationSummaryContextFactory = () =>
  modelTestContextFactory<NotificationSummary, NotificationSummaryDocument, APP_CODE_PREFIXApiNotificationSummaryTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationSummaryTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationSummaryTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationSummaryFirestoreCollection>({
    makeFixture: (f) => new APP_CODE_PREFIXApiNotificationSummaryTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationSummaryCollection,
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiNotificationSummaryTestContextInstance(delegate, ref, testInstance),
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

export const APP_CODE_PREFIX_CAMELNotificationSummaryContext = APP_CODE_PREFIX_CAMELNotificationSummaryContextFactory();

// MARK: NotificationBox
export interface APP_CODE_PREFIXApiNotificationBoxTestContextParams {
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

export class APP_CODE_PREFIXApiNotificationBoxTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationBox, NotificationBoxDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiNotificationBoxTestContextInstance<F>> {
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

export class APP_CODE_PREFIXApiNotificationBoxTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationBox, NotificationBoxDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {
  allNotificationsForNotificationBoxQuery() {
    const query = this.testContext.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationCollectionFactory(this.document).queryDocument();
    return query;
  }

  allNotificationWeeksForNotificationBoxQuery() {
    const query = this.testContext.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationWeekCollectionFactory(this.document).queryDocument();
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

export const APP_CODE_PREFIX_CAMELNotificationBoxContextFactory = () =>
  modelTestContextFactory<NotificationBox, NotificationBoxDocument, APP_CODE_PREFIXApiNotificationBoxTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationBoxTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationBoxTestContextFixture<FirebaseAdminFunctionTestContextInstance>, NotificationBoxFirestoreCollection>({
    makeFixture: (f) => new APP_CODE_PREFIXApiNotificationBoxTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationBoxCollection,
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiNotificationBoxTestContextInstance(delegate, ref, testInstance),
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

export const APP_CODE_PREFIX_CAMELNotificationBoxContext = APP_CODE_PREFIX_CAMELNotificationBoxContextFactory();

// MARK: Notification
export interface APP_CODE_PREFIXApiNotificationTestContextParams {
  readonly template?: Maybe<AsyncGetterOrValue<CreateNotificationTemplate>>;
}

export class APP_CODE_PREFIXApiNotificationTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Notification, NotificationDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiNotificationTestContextInstance<F>> {
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

export class APP_CODE_PREFIXApiNotificationTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Notification, NotificationDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {
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

export const APP_CODE_PREFIX_CAMELNotificationContextFactory = () =>
  modelTestContextFactory<Notification, NotificationDocument, APP_CODE_PREFIXApiNotificationTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new APP_CODE_PREFIXApiNotificationTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationCollectionGroup,
    collectionForDocument: (fi, doc) => {
      const parentDocument = fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationBoxCollection.documentAccessor().loadDocument(doc.parent);
      return fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationCollectionFactory(parentDocument);
    },
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiNotificationTestContextInstance(delegate, ref, testInstance),
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

export const APP_CODE_PREFIX_CAMELNotificationContext = APP_CODE_PREFIX_CAMELNotificationContextFactory();

// MARK: NotificationWeek
export interface APP_CODE_PREFIXApiNotificationWeekTestContextParams {
  nb: APP_CODE_PREFIXApiNotificationBoxTestContextFixture;
  /**
   * Week to target. If not set, defaults to today.
   */
  week?: YearWeekCode;
  /**
   * Whether or not to initialize the week. Defaults to true.
   */
  init?: boolean;
}

export class APP_CODE_PREFIXApiNotificationWeekTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<NotificationWeek, NotificationWeekDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>, APP_CODE_PREFIXApiFunctionContextFixture<F>, APP_CODE_PREFIXApiNotificationWeekTestContextInstance<F>> {}

export class APP_CODE_PREFIXApiNotificationWeekTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationWeek, NotificationWeekDocument, APP_CODE_PREFIXApiFunctionContextFixtureInstance<F>> {}

export const APP_CODE_PREFIX_CAMELNotificationWeekContextFactory = () =>
  modelTestContextFactory<NotificationWeek, NotificationWeekDocument, APP_CODE_PREFIXApiNotificationWeekTestContextParams, APP_CODE_PREFIXApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationWeekTestContextInstance<FirebaseAdminFunctionTestContextInstance>, APP_CODE_PREFIXApiNotificationWeekTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
    makeFixture: (f) => new APP_CODE_PREFIXApiNotificationWeekTestContextFixture(f),
    getCollection: (fi) => fi.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationWeekCollectionGroup,
    makeInstance: (delegate, ref, testInstance) => new APP_CODE_PREFIXApiNotificationWeekTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const week = params.week ?? yearWeekCode(new Date());
      const notificationWeekDocument = p.APP_CODE_PREFIX_CAMELFirestoreCollections.notificationWeekCollectionFactory(params.nb.document).documentAccessor().loadDocumentForId(`${week}`);
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

export const APP_CODE_PREFIX_CAMELNotificationWeekContext = APP_CODE_PREFIX_CAMELNotificationWeekContextFactory();
