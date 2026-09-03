import {
  DEMO_EXAMPLE_FORM_SPACE_TYPE,
  demoGuestbookFormSpaceId,
  profileIdentity,
  type Guestbook,
  type GuestbookDocument,
  type GuestbookEntry,
  type GuestbookEntryDocument,
  DemoFirestoreCollections,
  type ProfileDocument,
  type GuestbookEntryFirestoreCollection,
  type Profile,
  type ProfileFirestoreCollection,
  type InsertGuestbookEntryParams
} from 'demo-firebase';
import {
  authorizedUserContextFactory,
  AuthorizedUserTestContextFixture,
  AuthorizedUserTestContextInstance,
  firebaseAdminFunctionNestContextFactory,
  FirebaseAdminFunctionNestTestContextFixture,
  FirebaseAdminFunctionNestTestContextInstance,
  type FirebaseAdminFunctionTestContextInstance,
  firebaseAdminNestContextFactory,
  FirebaseAdminNestTestContextFixture,
  FirebaseAdminNestTestContextInstance,
  type FirebaseAdminTestContextInstance,
  initFirebaseAdminTestEnvironment,
  modelTestContextFactory,
  ModelTestContextFixture,
  ModelTestContextInstance,
  oAuthAuthorizedSuperTestContextFactory,
  setupFirebaseAdminFunctionTestSingleton
} from '@dereekb/firebase-server/test';
import { type BuildTestsWithContextFunction, type TestContextFixture } from '@dereekb/util/test';
import { Module } from '@nestjs/common';
import { DemoApiAppModule } from '../app/app.module';
import { DEMO_API_NEST_SERVER_CONFIG } from '../app/app';
import { initUserOnCreate } from '../app/function/auth/init.user.function';
import { DemoApiNestContext } from '../app/function/function.context';
import { DemoApiServerNestContext } from '../app/server/server.context';
import {
  type CleanupSentNotificationsParams,
  type DocumentReference,
  type FirebaseAuthUserId,
  type FirestoreCollection,
  type FirestoreModelKey,
  type InitializeAllApplicableNotificationBoxesParams,
  type InitializeNotificationModelParams,
  type NotificationBox,
  type NotificationBoxDocument,
  type NotificationBoxFirestoreCollection,
  type Notification,
  type NotificationDocument,
  type NotificationWeek,
  type NotificationWeekDocument,
  type SendNotificationParams,
  getDocumentSnapshotDataPairs,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  type UpdateNotificationBoxRecipientParams,
  type NotificationSummary,
  type NotificationSummaryDocument,
  type NotificationSummaryFirestoreCollection,
  type NotificationUser,
  type NotificationUserDocument,
  type NotificationUserFirestoreCollection,
  type CreateNotificationTemplate,
  createNotificationDocument,
  type UpdateNotificationUserParams,
  type ExpireAllExpiredFormSpacesParams,
  type ExpireAllExpiredFormSpacesResult,
  type FormSpace,
  type FormSpaceData,
  type FormSpaceDocument,
  type FormSpaceFileSlot,
  type FormSpaceFirestoreCollection,
  type FormSpaceType,
  formSpaceUploadsFilePath,
  storageFilesForFormSpaceQuery,
  firestoreModelKey,
  type InitializeAllStorageFilesFromUploadsParams,
  type InitializeAllStorageFilesFromUploadsResult,
  type ProcessAllQueuedStorageFilesResult,
  type RemoveFormSpaceFileParams,
  type ProcessAllQueuedFormSpacesResult,
  type SubmitFormSpaceParams,
  type SubmitFormSpaceResult,
  type Calendar,
  type CalendarDocument,
  type CalendarFirestoreCollection,
  calendarIdForModel,
  calendarSyncState,
  inferCalendarRelatedModelKey,
  type CalendarSyncState,
  type StorageFile,
  type StorageFileDocument,
  type StoragePath,
  type StorageFileFirestoreCollection,
  type ProcessStorageFileParams,
  type FirebaseStorageContext,
  type SyncStorageFileWithGroupsResult,
  type RegenerateStorageFileGroupContentResult,
  type StorageFileGroup,
  type StorageFileGroupDocument,
  type StorageFileGroupId,
  type StorageFileGroupFirestoreCollection,
  type SyncAllFlaggedStorageFilesWithGroupsResult,
  type RegenerateAllFlaggedStorageFileGroupsContentResult,
  type UserExternalConnection,
  type UserExternalConnectionDocument,
  type UserExternalConnectionFirestoreCollection,
  type UserExternalConnectionProviderType,
  CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
  type SyncCalendarResult,
  type SyncAllFlaggedCalendarsResult,
  type RotateCalendarIcsResult
} from '@dereekb/firebase';
import { type YearWeekCode, yearWeekCode } from '@dereekb/date';
import { objectHasKeys, type ContentTypeMimeType, type SlashPathFile, type Maybe, type AsyncGetterOrValue, getValueFromGetter, type AsyncFactory, type Milliseconds, MS_IN_MINUTE, waitForMs } from '@dereekb/util';
import {
  markStorageFileForDeleteTemplate,
  NotificationExpediteService,
  CalendarServerActions,
  type CreateFormSpaceActionInput,
  FormSpaceServerActions,
  NotificationInitServerActions,
  NotificationSendService,
  NotificationServerActions,
  NotificationTaskService,
  StorageFileInitServerActions,
  StorageFileServerActions,
  UserExternalConnectionAccessor,
  type UserExternalConnectionConnectParams,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionCredentialsRefresher,
  type UserExternalConnectionDisconnectParams,
  type UserExternalConnectionMarkErrorParams,
  type UserExternalConnectionPrivate,
  type UserExternalConnectionPrivateDocument,
  type UserExternalConnectionPrivateFirestoreCollection,
  UserExternalConnectionReader,
  userExternalConnectionReader,
  type UserExternalConnectionReaderProviderInstance,
  type UserExternalConnectionRefreshCredentialsInput,
  UserExternalConnectionServerActions,
  UserExternalConnectionServerFirestoreCollections
} from '@dereekb/firebase-server/model';
import { UserExternalConnectionCalcomUserContextService } from '@dereekb/firebase-server/calcom';
import { type OpenRouterModelConfig, type OpenRouterPromptDefinition, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';
import {
  type CreateOpenRouterPromptVersionParams,
  type CreateOpenRouterPromptVersionResult,
  type OpenRouterPrompt,
  type OpenRouterPromptDocument,
  type OpenRouterPromptFirestoreCollection,
  type OpenRouterPromptVersion,
  type OpenRouterPromptVersionDocument,
  type OpenRouterPromptVersionFirestoreCollection,
  type UpdateOpenRouterPromptParams,
  type UpdateOpenRouterPromptVersionParams,
  type UpdateOpenRouterPromptVersionResult,
  openRouterPromptVersionId,
  openRouterPromptVersionNumberFromId
} from '@dereekb/openrouter/firebase';
import { OPENROUTER_RUN_TASK_SERVICE_TOKEN, OpenRouterPromptServerActions, type OpenRouterRunTaskService, type SeedOpenRouterPromptsParams, type SeedOpenRouterPromptsResult, openRouterPromptServerActions, openRouterPromptService } from '@dereekb/openrouter/firebase-server';
import { type FirebaseServerEnvironmentConfig, FirebaseServerEnvService, assertSnapshotData } from '@dereekb/firebase-server';
import { DemoApiAuthService, DemoFirebaseServerActionsContext, DemoFirebaseServerActionsContextWithNotificationServices, GuestbookServerActions, ProfileServerActions } from '../app/common';
import { MailgunService } from '@dereekb/nestjs/mailgun';

// MARK: Demo Api Testing Fixture
@Module({
  imports: [DemoApiAppModule]
})
export class TestDemoApiAppModule {}

/**
 * Initializes the Firebase Admin test environment for demo API integration tests.
 * Configures emulator connections for auth, Firestore, and storage, then sets up
 * the shared function test singleton.
 */
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
  get storageContext(): FirebaseStorageContext;
  get envService(): FirebaseServerEnvService;
  get calendarServerActions(): CalendarServerActions;
  get formSpaceServerActions(): FormSpaceServerActions;
  get notificationServerActions(): NotificationServerActions;
  get notificationInitServerActions(): NotificationInitServerActions;
  get notificationSendService(): NotificationSendService;
  get notificationTaskService(): NotificationTaskService;
  get storageFileServerActions(): StorageFileServerActions;
  get openRouterPromptServerActions(): OpenRouterPromptServerActions;
  get openRouterRunTaskService(): OpenRouterRunTaskService;
  get userExternalConnectionServerFirestoreCollections(): UserExternalConnectionServerFirestoreCollections;
  get userExternalConnectionServerActions(): UserExternalConnectionServerActions;
  get userExternalConnectionAccessor(): UserExternalConnectionAccessor;
  get userExternalConnectionReader(): UserExternalConnectionReader;
  get userExternalConnectionCalcomUserContextService(): UserExternalConnectionCalcomUserContextService;
}

// MARK: Admin
export class DemoApiContextFixture<F extends FirebaseAdminTestContextInstance = FirebaseAdminTestContextInstance> extends FirebaseAdminNestTestContextFixture<F, TestContextFixture<F>, DemoApiContextFixtureInstance<F>> implements DemoApiContext {
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

  get calendarServerActions() {
    return this.instance.calendarServerActions;
  }

  get formSpaceServerActions() {
    return this.instance.formSpaceServerActions;
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

  get notificationExpediteService() {
    return this.instance.notificationExpediteService;
  }

  get notificationTaskService() {
    return this.instance.notificationTaskService;
  }

  get storageFileServerActions() {
    return this.instance.storageFileServerActions;
  }

  get storageFileInitServerActions() {
    return this.instance.storageFileInitServerActions;
  }

  get openRouterPromptServerActions() {
    return this.instance.openRouterPromptServerActions;
  }

  get openRouterRunTaskService() {
    return this.instance.openRouterRunTaskService;
  }

  get storageContext() {
    return this.instance.storageContext;
  }

  get envService() {
    return this.instance.envService;
  }

  get profileServerActions() {
    return this.instance.profileServerActions;
  }

  get guestbookServerActions() {
    return this.instance.guestbookServerActions;
  }

  get userExternalConnectionServerFirestoreCollections() {
    return this.instance.userExternalConnectionServerFirestoreCollections;
  }

  get userExternalConnectionServerActions() {
    return this.instance.userExternalConnectionServerActions;
  }

  get userExternalConnectionAccessor() {
    return this.instance.userExternalConnectionAccessor;
  }

  get userExternalConnectionReader() {
    return this.instance.userExternalConnectionReader;
  }

  get userExternalConnectionCalcomUserContextService() {
    return this.instance.userExternalConnectionCalcomUserContextService;
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

  get apiServerNestContext(): DemoApiServerNestContext {
    return new DemoApiServerNestContext(this.apiNestContext);
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

  get calendarServerActions() {
    return this.get(CalendarServerActions);
  }

  get formSpaceServerActions() {
    return this.get(FormSpaceServerActions);
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

  get notificationExpediteService() {
    return this.get(NotificationExpediteService);
  }

  get notificationTaskService() {
    return this.get(NotificationTaskService);
  }

  get storageFileServerActions() {
    return this.get(StorageFileServerActions);
  }

  get storageFileInitServerActions() {
    return this.get(StorageFileInitServerActions);
  }

  get openRouterPromptServerActions() {
    return this.get(OpenRouterPromptServerActions);
  }

  get openRouterRunTaskService(): OpenRouterRunTaskService {
    return this.get(OPENROUTER_RUN_TASK_SERVICE_TOKEN);
  }

  get envService(): FirebaseServerEnvService {
    return this.get(FirebaseServerEnvService);
  }

  get profileServerActions() {
    return this.get(ProfileServerActions);
  }

  get guestbookServerActions() {
    return this.get(GuestbookServerActions);
  }

  get userExternalConnectionServerFirestoreCollections() {
    return this.get(UserExternalConnectionServerFirestoreCollections);
  }

  get userExternalConnectionServerActions() {
    return this.get(UserExternalConnectionServerActions);
  }

  get userExternalConnectionAccessor() {
    return this.get(UserExternalConnectionAccessor);
  }

  get userExternalConnectionReader() {
    return this.get(UserExternalConnectionReader);
  }

  get userExternalConnectionCalcomUserContextService() {
    return this.get(UserExternalConnectionCalcomUserContextService);
  }
}

// Mirror the dev runtime: explicitly configure `appMcpUrl` so the OIDC resource-server
// wiring and the MCP module's advertised `mcpUrl` share an origin in tests. Without this,
// the OIDC `resourceServers` map (derived from `envService.appMcpUrl`) would be empty and
// every /authorize?...&resource=<mcpUrl> request would fail with `invalid_target`.
const DEMO_API_TEST_ENV_CONFIG: FirebaseServerEnvironmentConfig = {
  production: false,
  appUrl: 'http://localhost:404',
  appMcpUrl: 'http://localhost:404/mcp'
};

const _demoApiContextFactory = firebaseAdminNestContextFactory({
  nestModules: TestDemoApiAppModule,
  serverInstanceConfig: DEMO_API_NEST_SERVER_CONFIG,
  envConfig: DEMO_API_TEST_ENV_CONFIG,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new DemoApiContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiContextFixtureInstance<FirebaseAdminTestContextInstance>(instance, nest)
});

export const demoApiContextFactory = (buildTests: BuildTestsWithContextFunction<DemoApiContextFixture>) => {
  initDemoApiTestEnvironment();
  return _demoApiContextFactory(buildTests as any);
};

// MARK: Admin Function
export class DemoApiFunctionContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance>
  extends FirebaseAdminFunctionNestTestContextFixture<FirebaseAdminFunctionTestContextInstance, TestContextFixture<FirebaseAdminFunctionTestContextInstance>, DemoApiContextFixtureInstance<F>>
  implements DemoApiContext
{
  get storageContext() {
    return this.instance.storageContext;
  }

  get envService() {
    return this.instance.envService;
  }

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

  get calendarServerActions() {
    return this.instance.calendarServerActions;
  }

  get formSpaceServerActions() {
    return this.instance.formSpaceServerActions;
  }

  get notificationServerActions() {
    return this.instance.notificationServerActions;
  }

  get notificationSendService() {
    return this.instance.notificationSendService;
  }

  get notificationExpediteService() {
    return this.instance.notificationExpediteService;
  }

  get notificationTaskService() {
    return this.instance.notificationTaskService;
  }

  get notificationInitServerActions() {
    return this.instance.notificationInitServerActions;
  }

  get storageFileServerActions() {
    return this.instance.storageFileServerActions;
  }

  get storageFileInitServerActions() {
    return this.instance.storageFileInitServerActions;
  }

  get openRouterPromptServerActions() {
    return this.instance.openRouterPromptServerActions;
  }

  get openRouterRunTaskService() {
    return this.instance.openRouterRunTaskService;
  }

  get profileServerActions() {
    return this.instance.profileServerActions;
  }

  get guestbookServerActions() {
    return this.instance.guestbookServerActions;
  }

  get userExternalConnectionServerFirestoreCollections() {
    return this.instance.userExternalConnectionServerFirestoreCollections;
  }

  get userExternalConnectionServerActions() {
    return this.instance.userExternalConnectionServerActions;
  }

  get userExternalConnectionAccessor() {
    return this.instance.userExternalConnectionAccessor;
  }

  get userExternalConnectionReader() {
    return this.instance.userExternalConnectionReader;
  }

  get userExternalConnectionCalcomUserContextService() {
    return this.instance.userExternalConnectionCalcomUserContextService;
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

  get apiServerNestContext(): DemoApiServerNestContext {
    return new DemoApiServerNestContext(this.apiNestContext);
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

  get calendarServerActions() {
    return this.get(CalendarServerActions);
  }

  get formSpaceServerActions() {
    return this.get(FormSpaceServerActions);
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

  get notificationExpediteService() {
    return this.get(NotificationExpediteService);
  }

  get notificationTaskService() {
    return this.get(NotificationTaskService);
  }

  get storageFileServerActions() {
    return this.get(StorageFileServerActions);
  }

  get storageFileInitServerActions() {
    return this.get(StorageFileInitServerActions);
  }

  get openRouterPromptServerActions() {
    return this.get(OpenRouterPromptServerActions);
  }

  get openRouterRunTaskService(): OpenRouterRunTaskService {
    return this.get(OPENROUTER_RUN_TASK_SERVICE_TOKEN);
  }

  get envService(): FirebaseServerEnvService {
    return this.get(FirebaseServerEnvService);
  }

  get profileServerActions() {
    return this.get(ProfileServerActions);
  }

  get guestbookServerActions() {
    return this.get(GuestbookServerActions);
  }

  get userExternalConnectionServerFirestoreCollections() {
    return this.get(UserExternalConnectionServerFirestoreCollections);
  }

  get userExternalConnectionServerActions() {
    return this.get(UserExternalConnectionServerActions);
  }

  get userExternalConnectionAccessor() {
    return this.get(UserExternalConnectionAccessor);
  }

  get userExternalConnectionReader() {
    return this.get(UserExternalConnectionReader);
  }

  get userExternalConnectionCalcomUserContextService() {
    return this.get(UserExternalConnectionCalcomUserContextService);
  }
}

const _demoApiFunctionContextFactory = firebaseAdminFunctionNestContextFactory({
  nestModules: TestDemoApiAppModule,
  serverInstanceConfig: DEMO_API_NEST_SERVER_CONFIG,
  envConfig: DEMO_API_TEST_ENV_CONFIG,
  injectFirebaseServerAppTokenProvider: true,
  makeFixture: (parent) => new DemoApiFunctionContextFixture(parent),
  makeInstance: (instance, nest) => new DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>(instance, nest)
});

export const demoApiFunctionContextFactory = (buildTests: BuildTestsWithContextFunction<DemoApiFunctionContextFixture>) => {
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
  readonly onboarded?: boolean;
  readonly demoUserLevel?: 'admin' | 'user';
}

export const demoAuthorizedUserContextFactory = (params: DemoAuthorizedUserContextFactoryConfig) =>
  authorizedUserContextFactory<
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiAuthorizedUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiAuthorizedUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>
  >({
    makeFixture: (f) => new DemoApiAuthorizedUserTestContextFixture(f),
    makeUserDetails: () => ({ claims: { o: params.onboarded === false ? 0 : 1, a: params.demoUserLevel === 'admin' ? 1 : 0, demoUserLevel: params.demoUserLevel ?? 'user' } }),
    makeInstance: (uid, testInstance) => new DemoApiAuthorizedUserTestContextInstance(uid, testInstance),
    initUser: async (instance) => {
      const userRecord = await instance.loadUserRecord();
      const fn = instance.testContext.fnWrapper.wrapBlockingFunction(initUserOnCreate(instance.nestAppPromiseGetter));
      await instance.callAuthBlockingFunction({ fn, userRecord, eventType: 'google.firebase.auth.user.create' });
    }
  });

export const demoAuthorizedUserContext = demoAuthorizedUserContextFactory({});
export const demoAuthorizedUserAdminContext = demoAuthorizedUserContextFactory({ demoUserLevel: 'admin' });

// MARK: With Profile
export interface DemoApiProfileTestContextParams {
  readonly u: DemoApiAuthorizedUserTestContextFixture;
}

export class DemoApiProfileTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiProfileTestContextInstance<F>> {}

export class DemoApiProfileTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Profile, ProfileDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoProfileContextFactory = () =>
  modelTestContextFactory<
    Profile,
    ProfileDocument,
    DemoApiProfileTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiProfileTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiProfileTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    ProfileFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiProfileTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.profileCollection,
    makeRef: async (collection: FirestoreCollection<Profile, ProfileDocument>, params, _p) => {
      return collection.documentAccessor().documentRefForId(params.u.uid);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiProfileTestContextInstance(delegate, ref, testInstance)
  });

export const demoProfileContext = demoProfileContextFactory();

// MARK: With Calendar
export interface DemoApiCalendarTestContextParams {
  /**
   * The Profile that owns the Calendar. The Calendar's document id IS the Profile's two-way flat key,
   * so no lookup field and no query is involved — the id is derived from this fixture.
   */
  readonly profile: DemoApiProfileTestContextFixture;
  /**
   * When true, seeds the Calendar by adding a test event to the Profile, which is what creates the
   * Calendar document and flags it for the next sweep.
   *
   * Defaults to false, so a test can assert the "no calendar yet" state.
   */
  readonly createTestCalendarEvent?: Maybe<boolean | string>;
}

export class DemoApiCalendarTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<Calendar, CalendarDocument, DemoApiFunctionContextFixtureInstance<F>, DemoApiFunctionContextFixture<F>, DemoApiCalendarTestContextInstance<F>> {
  async createTestCalendarEvent(name?: Maybe<string>): Promise<void> {
    return this.instance.createTestCalendarEvent(name);
  }

  async createTestRecurringCalendarEvent(recurrenceRule: string, name?: Maybe<string>): Promise<void> {
    return this.instance.createTestRecurringCalendarEvent(recurrenceRule, name);
  }

  async syncCalendar(): Promise<SyncCalendarResult> {
    return this.instance.syncCalendar();
  }

  async syncAllFlaggedCalendars(): Promise<SyncAllFlaggedCalendarsResult> {
    return this.instance.syncAllFlaggedCalendars();
  }

  async rotateCalendarIcs(): Promise<RotateCalendarIcsResult> {
    return this.instance.rotateCalendarIcs();
  }

  async loadIcsStorageFileDocument(): Promise<StorageFileDocument> {
    return this.instance.loadIcsStorageFileDocument();
  }

  async syncState(): Promise<CalendarSyncState> {
    return this.instance.syncState();
  }
}

export class DemoApiCalendarTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Calendar, CalendarDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Adds an event to the owning Profile's calendar, which creates/updates the Calendar and flags it for
   * the next sweep. The event action lives on the Profile, since that is the model the demo exposes.
   */
  async createTestCalendarEvent(name?: Maybe<string>): Promise<void> {
    return this._createTestCalendarEvent({ name });
  }

  /**
   * Adds a RECURRING event to the owning Profile's calendar.
   *
   * Worth its own helper because a recurring item lands in the calendar's `r` array rather than `e`, and the
   * publish path renders it as an RRULE on one VEVENT instead of a discrete VEVENT per occurrence — a
   * different branch of `calendarToICalendar()` than every one-off event exercises.
   */
  async createTestRecurringCalendarEvent(recurrenceRule: string, name?: Maybe<string>): Promise<void> {
    return this._createTestCalendarEvent({ name, recurrenceRule });
  }

  private async _createTestCalendarEvent(params: { readonly name?: Maybe<string>; readonly recurrenceRule?: Maybe<string> }): Promise<void> {
    const profileDocument = this.testContext.demoFirestoreCollections.profileCollection.documentAccessor().loadDocumentForKey(inferCalendarRelatedModelKey(this.documentId));
    const createTestCalendarEvent = await this.testContext.profileServerActions.createTestCalendarEvent(params);
    await createTestCalendarEvent(profileDocument);
  }

  /**
   * Syncs THIS calendar directly.
   */
  async syncCalendar(): Promise<SyncCalendarResult> {
    const syncCalendar = await this.testContext.calendarServerActions.syncCalendar({ key: this.documentKey });
    return syncCalendar(this.document);
  }

  /**
   * One pass of the calendar half of `calendarHourlyUpdateSchedule`.
   */
  async syncAllFlaggedCalendars(): Promise<SyncAllFlaggedCalendarsResult> {
    const syncAllFlaggedCalendars = await this.testContext.calendarServerActions.syncAllFlaggedCalendars({});
    return syncAllFlaggedCalendars();
  }

  /**
   * Rotates THIS calendar's published ICS link, revoking the previous one.
   */
  async rotateCalendarIcs(): Promise<RotateCalendarIcsResult> {
    const rotateCalendarIcs = await this.testContext.calendarServerActions.rotateCalendarIcs({ key: this.documentKey });
    return rotateCalendarIcs(this.document);
  }

  /**
   * The ICS StorageFile this calendar publishes to. Throws if the calendar has not created one yet.
   */
  async loadIcsStorageFileDocument(): Promise<StorageFileDocument> {
    const calendar = await this.document.snapshotData();

    if (!calendar?.isf) {
      throw new Error('Calendar not found or does not have an ICS StorageFile associated.');
    }

    return this.testContext.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(calendar.isf);
  }

  async syncState(): Promise<CalendarSyncState> {
    const calendar = await this.document.snapshotData();

    if (!calendar) {
      throw new Error('Calendar does not exist.');
    }

    return calendarSyncState(calendar);
  }
}

export const demoCalendarContextFactory = () =>
  modelTestContextFactory<
    Calendar,
    CalendarDocument,
    DemoApiCalendarTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiCalendarTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiCalendarTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    CalendarFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiCalendarTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.calendarCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiCalendarTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection: FirestoreCollection<Calendar, CalendarDocument>, params, _p) => {
      return collection.documentAccessor().documentRefForId(calendarIdForModel(params.profile.document.key));
    },
    initDocument: async (instance, params) => {
      if (params.createTestCalendarEvent) {
        await instance.createTestCalendarEvent(typeof params.createTestCalendarEvent === 'string' ? params.createTestCalendarEvent : undefined);
      }
    }
  });

export const demoCalendarContext = demoCalendarContextFactory();

// MARK: With Guestbook
export interface DemoApiGuestbookTestContextParams extends Partial<Guestbook> {
  /**
   * The user that created the guestbook, written to `cby`.
   *
   * A FIXTURE rather than a uid: `buildTests` runs at describe-registration time, when a user fixture's
   * instance does not exist yet, so `u.uid` there throws. The uid is read in `initDocument`, which runs in
   * `beforeEach` alongside every other fixture.
   */
  readonly createdBy?: Maybe<DemoApiAuthorizedUserTestContextFixture>;
}

export class DemoApiGuestbookTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  Guestbook,
  GuestbookDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiGuestbookTestContextInstance<F>
> {}

export class DemoApiGuestbookTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<Guestbook, GuestbookDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoGuestbookContextFactory = () =>
  modelTestContextFactory<
    Guestbook,
    GuestbookDocument,
    DemoApiGuestbookTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiGuestbookTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiGuestbookTestContextFixture<FirebaseAdminFunctionTestContextInstance>
  >({
    makeFixture: (f) => new DemoApiGuestbookTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.guestbookCollection,
    collectionForDocument: (fi, _doc) => {
      return fi.demoFirestoreCollections.guestbookCollection;
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiGuestbookTestContextInstance(delegate, ref, testInstance),
    initDocument: async (instance, params) => {
      const guestbook = instance.document;

      await guestbook.accessor.set({
        name: params.name ?? 'test',
        published: params.published ?? true,
        locked: params.locked ?? false,
        lockedAt: params.lockedAt ?? (params.locked ? new Date() : undefined),
        // written so a test can assert on the creator. The guestbook's SHARED FormSpace takes its `u` from
        // here, and a guestbook with no creator would silently hand `u` to whoever opened the album.
        cby: params.createdBy?.uid ?? params.cby
      });
    }
  });

export const demoGuestbookContext = demoGuestbookContextFactory();

// MARK: Guestbook Entry
export interface DemoApiGuestbookEntryTestContextParams extends Partial<GuestbookEntry> {
  readonly init?: boolean;
  readonly u: DemoApiAuthorizedUserTestContextFixture;
  readonly g: DemoApiGuestbookTestContextFixture;
}

export class DemoApiGuestbookEntryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  GuestbookEntry,
  GuestbookEntryDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiGuestbookEntryTestContextInstance<F>
> {
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
  modelTestContextFactory<
    GuestbookEntry,
    GuestbookEntryDocument,
    DemoApiGuestbookEntryTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiGuestbookEntryTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiGuestbookEntryTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    GuestbookEntryFirestoreCollection
  >({
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
  readonly u: DemoApiAuthorizedUserTestContextFixture;
  readonly init?: boolean;
}

export class DemoApiNotificationUserTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  NotificationUser,
  NotificationUserDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiNotificationUserTestContextInstance<F>
> {
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
  modelTestContextFactory<
    NotificationUser,
    NotificationUserDocument,
    DemoApiNotificationUserTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationUserTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationUserTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    NotificationUserFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiNotificationUserTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationUserCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationUserTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, _p) => {
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
  readonly for: ModelTestContextFixture<any, any, any, any, any>;
  readonly ownershipKey?: FirestoreModelKey | ModelTestContextFixture<any, any, any, any, any>;
  readonly createIfNeeded?: boolean;
  readonly initIfNeeded?: boolean;
}

export class DemoApiNotificationSummaryTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  NotificationSummary,
  NotificationSummaryDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiNotificationSummaryTestContextInstance<F>
> {}

export class DemoApiNotificationSummaryTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationSummary, NotificationSummaryDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoNotificationSummaryContextFactory = () =>
  modelTestContextFactory<
    NotificationSummary,
    NotificationSummaryDocument,
    DemoApiNotificationSummaryTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationSummaryTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationSummaryTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    NotificationSummaryFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiNotificationSummaryTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationSummaryCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationSummaryTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, _p) => {
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
  readonly for: ModelTestContextFixture<any, any, any, any, any>;
  readonly ownershipKey?: FirestoreModelKey | ModelTestContextFixture<any, any, any, any, any>;
  /**
   * Whether or not to create the NotificationBox. Defaults to false.
   */
  readonly createIfNeeded?: boolean;
  /**
   * Whether or not to create and initialize. Defaults to false.
   */
  readonly initIfNeeded?: boolean;
}

export class DemoApiNotificationBoxTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  NotificationBox,
  NotificationBoxDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiNotificationBoxTestContextInstance<F>
> {
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
    return this.testContext.demoFirestoreCollections.notificationCollectionFactory(this.document).queryDocument();
  }

  allNotificationWeeksForNotificationBoxQuery() {
    return this.testContext.demoFirestoreCollections.notificationWeekCollectionFactory(this.document).queryDocument();
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
  modelTestContextFactory<
    NotificationBox,
    NotificationBoxDocument,
    DemoApiNotificationBoxTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationBoxTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationBoxTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    NotificationBoxFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiNotificationBoxTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationBoxCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationBoxTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, _p) => {
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
  readonly template?: Maybe<AsyncGetterOrValue<CreateNotificationTemplate>>;
}

export class DemoApiNotificationTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  Notification,
  NotificationDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiNotificationTestContextInstance<F>
> {
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
   *
   * @returns The result of sending all queued notifications.
   */
  async sendAllQueuedNotifications() {
    const sendAllQueuedNotifications = await this.testContext.notificationServerActions.sendQueuedNotifications({});
    return sendAllQueuedNotifications();
  }

  /**
   * Cleanup all sent notifications.
   *
   * @returns The result of the cleanup operation.
   */
  async cleanupAllSentNotifications() {
    const params: CleanupSentNotificationsParams = {};
    const cleanupSentNotifications = await this.testContext.notificationServerActions.cleanupSentNotifications(params);
    return cleanupSentNotifications();
  }

  /**
   * Sends the notification.
   *
   * @param params - Optional send parameters (key is automatically set from the test context document)
   * @returns The result of sending the notification.
   */
  async sendNotification(params?: Maybe<Omit<SendNotificationParams, 'key'>>) {
    const sendNotification = await this.testContext.notificationServerActions.sendNotification({ ...params, key: this.documentKey });
    return sendNotification(this.document);
  }
}

export const demoNotificationContextFactory = () =>
  modelTestContextFactory<
    Notification,
    NotificationDocument,
    DemoApiNotificationTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationTestContextFixture<FirebaseAdminFunctionTestContextInstance>
  >({
    makeFixture: (f) => new DemoApiNotificationTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.notificationCollectionGroup,
    collectionForDocument: (fi, doc) => {
      const parentDocument = fi.demoFirestoreCollections.notificationBoxCollection.documentAccessor().loadDocument(doc.parent);
      return fi.demoFirestoreCollections.notificationCollectionFactory(parentDocument);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiNotificationTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, _p) => {
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
  readonly nb: DemoApiNotificationBoxTestContextFixture;
  /**
   * Week to target. If not set, defaults to today.
   */
  readonly week?: YearWeekCode;
  /**
   * Whether or not to initialize the NotificationWeek. Defaults to true.
   */
  readonly init?: boolean;
}

export class DemoApiNotificationWeekTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  NotificationWeek,
  NotificationWeekDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiNotificationWeekTestContextInstance<F>
> {}

export class DemoApiNotificationWeekTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<NotificationWeek, NotificationWeekDocument, DemoApiFunctionContextFixtureInstance<F>> {}

export const demoNotificationWeekContextFactory = () =>
  modelTestContextFactory<
    NotificationWeek,
    NotificationWeekDocument,
    DemoApiNotificationWeekTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationWeekTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiNotificationWeekTestContextFixture<FirebaseAdminFunctionTestContextInstance>
  >({
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

// MARK: FormSpace
export interface DemoApiFormSpaceTestContextParams {
  /**
   * The user the FormSpace belongs to.
   */
  readonly u: AuthorizedUserTestContextFixture;
  /**
   * The FormSpaceType to create. Defaults to {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
   */
  readonly formSpaceType?: Maybe<FormSpaceType>;
  /**
   * Initial form data.
   */
  readonly data?: Maybe<FormSpaceData>;
  /**
   * Display name for the space.
   */
  readonly displayName?: Maybe<string>;
  /**
   * The Guestbook whose SHARED space this is.
   *
   * Sets the whole shared shape at once — `ownerKey`, `targetModelKey`, the derived id, and `u` (the
   * guestbook's creator, NOT `params.u`) — so a spec cannot build half of it by hand and get a space that
   * looks shared but grants `submit` to the wrong person.
   */
  readonly g?: Maybe<DemoApiGuestbookTestContextFixture>;
}

export class DemoApiFormSpaceTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  FormSpace,
  FormSpaceDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiFormSpaceTestContextInstance<F>
> {
  async uploadFileToSlot(input: DemoApiFormSpaceUploadInput): Promise<StoragePath> {
    return this.instance.uploadFileToSlot(input);
  }

  async uploadFileToSlotAsUser(uid: FirebaseAuthUserId, input: DemoApiFormSpaceUploadInput): Promise<StoragePath> {
    return this.instance.uploadFileToSlotAsUser(uid, input);
  }

  async initializeUploads(params?: Maybe<InitializeAllStorageFilesFromUploadsParams>): Promise<InitializeAllStorageFilesFromUploadsResult> {
    return this.instance.initializeUploads(params);
  }

  async submit(params?: Maybe<Omit<SubmitFormSpaceParams, 'key'>>): Promise<SubmitFormSpaceResult> {
    return this.instance.submit(params);
  }

  async reopen(uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    return this.instance.reopen(uid);
  }

  async lock(uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    return this.instance.lock(uid);
  }

  async removeFile(params: Omit<RemoveFormSpaceFileParams, 'key'>, uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    return this.instance.removeFile(params, uid);
  }

  async processStorageFiles(): Promise<ProcessAllQueuedStorageFilesResult> {
    return this.instance.processStorageFiles();
  }

  async loadProcessingTaskDocument(): Promise<NotificationDocument> {
    return this.instance.loadProcessingTaskDocument();
  }

  async loadStorageFiles(): Promise<StorageFileDocument[]> {
    return this.instance.loadStorageFiles();
  }

  async expireAllExpiredFormSpaces(params?: Maybe<ExpireAllExpiredFormSpacesParams>): Promise<ExpireAllExpiredFormSpacesResult> {
    return this.instance.expireAllExpiredFormSpaces(params);
  }

  async processAllQueuedFormSpaces(): Promise<ProcessAllQueuedFormSpacesResult> {
    return this.instance.processAllQueuedFormSpaces();
  }
}

/**
 * Input for {@link DemoApiFormSpaceTestContextInstance.uploadFileToSlot}.
 */
export interface DemoApiFormSpaceUploadInput {
  readonly slot: FormSpaceFileSlot;
  readonly filename: SlashPathFile;
  readonly content: string;
  readonly contentType: ContentTypeMimeType;
}

export class DemoApiFormSpaceTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<FormSpace, FormSpaceDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Writes a file into the FormSpace's uploads folder, exactly where a signed upload URL would put it.
   *
   * Does NOT initialize it — call {@link initializeUploads} for that, so a spec can assert on the state
   * between the bytes landing and the initializer accepting or rejecting them.
   */
  async uploadFileToSlot(input: DemoApiFormSpaceUploadInput): Promise<StoragePath> {
    const formSpace = await assertSnapshotData(this.document);
    return this.uploadFileToSlotAsUser(formSpace.u, input);
  }

  /**
   * Writes a file into ANOTHER user's uploads folder for this space.
   *
   * The uid is the UPLOADER's, not the space's `u`. `storage.rules` confines a write to the caller's own
   * namespace regardless of which space it targets, so this is exactly the shape a SHARED space's upload
   * has — and the shape a stranger's refused upload has too.
   */
  async uploadFileToSlotAsUser(uid: FirebaseAuthUserId, input: DemoApiFormSpaceUploadInput): Promise<StoragePath> {
    const { slot, filename, content, contentType } = input;
    const path = formSpaceUploadsFilePath({ uid, formSpaceId: this.documentId, slot, filename });
    const file = this.testContext.storageContext.file(path);

    await file.upload(content, { contentType, stringFormat: 'raw' });

    return { bucketId: file.storagePath.bucketId, pathString: file.storagePath.pathString };
  }

  /**
   * One pass of the uploads half of `storageFileHourlyUpdateSchedule`.
   *
   * Pass `{ expediteProcessing: true }` to also run each accepted file's processing task inline, which is
   * what a client gets from `storageFile.create:fromUpload` with the same flag.
   */
  async initializeUploads(params?: Maybe<InitializeAllStorageFilesFromUploadsParams>): Promise<InitializeAllStorageFilesFromUploadsResult> {
    const instance = await this.testContext.storageFileServerActions.initializeAllStorageFilesFromUploads(params ?? {});
    return instance();
  }

  async submit(params?: Maybe<Omit<SubmitFormSpaceParams, 'key'>>): Promise<SubmitFormSpaceResult> {
    const instance = await this.testContext.formSpaceServerActions.submitFormSpace({ ...params, key: this.documentKey });
    return instance(this.document);
  }

  /**
   * Reopens the submitted space back into an editable draft.
   *
   * The uid is WHO reopened, recorded on `rby`. Defaults to the space's own `u`, the shape every
   * single-user spec means.
   */
  async reopen(uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    const instance = await this.testContext.formSpaceServerActions.reopenFormSpace({ key: this.documentKey });
    const formSpace = await assertSnapshotData(this.document);
    await instance(this.document, { uid: uid ?? formSpace.u });
  }

  /**
   * Ends the space's reopen window immediately, recording the acting uid on `lby`.
   */
  async lock(uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    const instance = await this.testContext.formSpaceServerActions.lockFormSpace({ key: this.documentKey });
    const formSpace = await assertSnapshotData(this.document);
    await instance(this.document, { uid: uid ?? formSpace.u });
  }

  /**
   * Removes one file from a slot, flagging its StorageFile for deletion.
   *
   * The uid is WHO is removing, which the type's `FormSpaceFileAccess` may narrow the removal by. It
   * defaults to the space's own `u` — the shape every single-user spec means — so a spec only passes one
   * when it is exercising a SHARED space, where who is asking is the whole question.
   */
  async removeFile(params: Omit<RemoveFormSpaceFileParams, 'key'>, uid?: Maybe<FirebaseAuthUserId>): Promise<void> {
    const instance = await this.testContext.formSpaceServerActions.removeFormSpaceFile({ ...params, key: this.documentKey });
    const formSpace = await assertSnapshotData(this.document);
    await instance(this.document, { uid: uid ?? formSpace.u });
  }

  /**
   * One pass of the processing half of `storageFileHourlyUpdateSchedule`, which is what creates the `SFP`
   * task that runs a slot's validator.
   */
  async processStorageFiles(): Promise<ProcessAllQueuedStorageFilesResult> {
    const instance = await this.testContext.storageFileServerActions.processAllQueuedStorageFiles({});
    return instance();
  }

  async loadProcessingTaskDocument(): Promise<NotificationDocument> {
    const formSpace = await assertSnapshotData(this.document);

    if (!formSpace.pn) {
      throw new Error('FormSpace does not have a processing task key associated.');
    }

    return this.testContext.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(formSpace.pn);
  }

  /**
   * Every StorageFile that belongs to this FormSpace's group.
   */
  async loadStorageFiles(): Promise<StorageFileDocument[]> {
    return this.testContext.demoFirestoreCollections.storageFileCollection.queryDocument(storageFilesForFormSpaceQuery(this.documentKey)).getDocs();
  }

  async expireAllExpiredFormSpaces(params?: Maybe<ExpireAllExpiredFormSpacesParams>): Promise<ExpireAllExpiredFormSpacesResult> {
    const instance = await this.testContext.formSpaceServerActions.expireAllExpiredFormSpaces(params ?? {});
    return instance();
  }

  async processAllQueuedFormSpaces(): Promise<ProcessAllQueuedFormSpacesResult> {
    const instance = await this.testContext.formSpaceServerActions.processAllQueuedFormSpaces({});
    return instance();
  }
}

export const demoFormSpaceContextFactory = () =>
  modelTestContextFactory<
    FormSpace,
    FormSpaceDocument,
    DemoApiFormSpaceTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFormSpaceTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFormSpaceTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    FormSpaceFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiFormSpaceTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.formSpaceCollection,
    collectionForDocument: (fi, _doc) => fi.demoFirestoreCollections.formSpaceCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiFormSpaceTestContextInstance(delegate, ref, testInstance),
    makeRef: async (_collection, params, p) => {
      const guestbookFixture = params.g;
      const createFormSpace = await p.formSpaceServerActions.createFormSpace({
        formSpaceType: params.formSpaceType ?? DEMO_EXAMPLE_FORM_SPACE_TYPE,
        displayName: params.displayName,
        data: params.data,
        targetModelKey: guestbookFixture ? guestbookFixture.documentKey : undefined
      });

      let createInput: CreateFormSpaceActionInput;

      if (guestbookFixture) {
        const guestbook = await assertSnapshotData(guestbookFixture.document);

        createInput = {
          uid: guestbook.cby ?? params.u.uid,
          ownerKey: guestbookFixture.documentKey,
          formSpaceId: demoGuestbookFormSpaceId(guestbookFixture.documentKey),
          getOrCreate: true
        };
      } else {
        const uid = params.u.uid;
        createInput = { uid, ownerKey: firestoreModelKey(profileIdentity, uid) };
      }

      const formSpaceDocument = await createFormSpace(createInput);
      return formSpaceDocument.documentRef;
    }
  });

export const demoFormSpaceContext = demoFormSpaceContextFactory();

// MARK: StorageFile
export interface DemoApiStorageFileTestContextParams {
  /**
   * Creates an uploaded file and returns the path.
   *
   * This should go into the uploaded folder, or the folder where the system is expecting it to be for initializing a StorageFile from an uploaded file.
   */
  readonly createUploadedFile?: Maybe<AsyncFactory<StoragePath>>;
  /**
   * If true, will run processStorageFile() on the StorageFile.
   *
   * Defaults to false.
   */
  readonly processStorageFile?: Maybe<boolean | ProcessStorageFileParams>;
}

export class DemoApiStorageFileTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  StorageFile,
  StorageFileDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiStorageFileTestContextInstance<F>
> {
  async process(params?: Omit<ProcessStorageFileParams, 'key'>) {
    return this.instance.process(params);
  }

  async loadProcessingTaskDocument(): Promise<NotificationDocument> {
    return this.instance.loadProcessingTaskDocument();
  }

  async syncWithStorageFileGroups(): Promise<SyncStorageFileWithGroupsResult> {
    return this.instance.syncWithStorageFileGroups();
  }

  async syncAllFlaggedStorageFilesWithGroups(): Promise<SyncAllFlaggedStorageFilesWithGroupsResult> {
    return this.instance.syncAllFlaggedStorageFilesWithGroups();
  }

  async markForDeletion(): Promise<void> {
    return this.instance.markForDeletion();
  }

  async deleteStorageFile(force?: Maybe<boolean>): Promise<void> {
    return this.instance.deleteStorageFile(force);
  }
}

export class DemoApiStorageFileTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<StorageFile, StorageFileDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async process(params?: Omit<ProcessStorageFileParams, 'key'>) {
    const processStorageFileParams: ProcessStorageFileParams = {
      key: this.documentKey,
      ...params
    };

    const process = await this.testContext.storageFileServerActions.processStorageFile(processStorageFileParams);
    return process(this.document);
  }

  async loadProcessingTaskDocument(): Promise<NotificationDocument> {
    const storageFile = await this.document.snapshotData();

    if (!storageFile?.pn) {
      throw new Error('StorageFile not found or does not have a processing task key associated.');
    }

    const notificationTaskKey = storageFile.pn;
    return this.testContext.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(notificationTaskKey);
  }

  async syncWithStorageFileGroups(): Promise<SyncStorageFileWithGroupsResult> {
    const instance = await this.testContext.storageFileServerActions.syncStorageFileWithGroups({ key: this.documentKey });
    return instance(this.document);
  }

  async syncAllFlaggedStorageFilesWithGroups(): Promise<SyncAllFlaggedStorageFilesWithGroupsResult> {
    const instance = await this.testContext.storageFileServerActions.syncAllFlaggedStorageFilesWithGroups({});
    return instance();
  }

  async markForDeletion(): Promise<void> {
    await this.document.update(markStorageFileForDeleteTemplate());
  }

  async deleteStorageFile(force?: Maybe<boolean>): Promise<void> {
    const instance = await this.testContext.storageFileServerActions.deleteStorageFile({ key: this.documentKey, force });
    return instance(this.document);
  }
}

export const demoStorageFileContextFactory = () =>
  modelTestContextFactory<
    StorageFile,
    StorageFileDocument,
    DemoApiStorageFileTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiStorageFileTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiStorageFileTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    StorageFileFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiStorageFileTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.storageFileCollection,
    collectionForDocument: (fi, _doc) => fi.demoFirestoreCollections.storageFileCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiStorageFileTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      let ref: StorageFileDocument;

      if (params.createUploadedFile) {
        const { bucketId, pathString } = await getValueFromGetter(params.createUploadedFile);
        const initializeInstance = await p.storageFileServerActions.initializeStorageFileFromUpload({ bucketId, pathString });
        ref = await initializeInstance();
      } else {
        throw new Error('Must use createUploadedFile() to initialize a StorageFile, or use the "doc" parameter.');
      }

      return ref.documentRef;
    },
    initDocument: async (instance, params) => {
      const _p = instance.testContext;

      if (params.processStorageFile) {
        await instance.process(typeof params.processStorageFile === 'boolean' ? {} : params.processStorageFile);
      }
    }
  });

export const demoStorageFileContext = demoStorageFileContextFactory();

// MARK: StorageFileGroup
export interface DemoApiStorageFileGroupTestContextParams {
  /**
   * StorageFileGroup id to initialize for.
   */
  readonly storageFileGroupId?: Maybe<AsyncGetterOrValue<StorageFileGroupId>>;
  /**
   * Whether or not to create the StorageFileGroup. Defaults to false.
   */
  readonly createIfNeeded?: boolean;
  /**
   * Whether or not to create and initialize. Defaults to false.
   */
  readonly initIfNeeded?: boolean;
}

export class DemoApiStorageFileGroupTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  StorageFileGroup,
  StorageFileGroupDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiStorageFileGroupTestContextInstance<F>
> {
  async createStorageFileGroup(): Promise<void> {
    return this.instance.createStorageFileGroup();
  }

  async initializeStorageFileGroup(): Promise<void> {
    return this.instance.initializeStorageFileGroup();
  }

  async regenerateStorageFileGroupContent(): Promise<RegenerateStorageFileGroupContentResult> {
    return this.instance.regenerateStorageFileGroupContent();
  }

  async regenerateAllFlaggedStorageFileGroupsContent(): Promise<RegenerateAllFlaggedStorageFileGroupsContentResult> {
    return this.instance.regenerateAllFlaggedStorageFileGroupsContent();
  }

  async processZipFileRegeneration(): Promise<StorageFileDocument> {
    return this.instance.processZipFileRegeneration();
  }
}

export class DemoApiStorageFileGroupTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<StorageFileGroup, StorageFileGroupDocument, DemoApiFunctionContextFixtureInstance<F>> {
  async createStorageFileGroup() {
    const createStorageFileGroup = await this.testContext.storageFileServerActions.createStorageFileGroup({
      storageFileId: this.documentId
    });

    await createStorageFileGroup();
  }

  async initializeStorageFileGroup(): Promise<void> {
    const initStorageFileGroup = await this.testContext.storageFileInitServerActions.initializeStorageFileGroup({
      key: this.documentKey
    });

    await initStorageFileGroup(this.document);
  }

  async regenerateStorageFileGroupContent(): Promise<RegenerateStorageFileGroupContentResult> {
    const instance = await this.testContext.storageFileServerActions.regenerateStorageFileGroupContent({ key: this.documentKey });
    return instance(this.document);
  }

  async regenerateAllFlaggedStorageFileGroupsContent(): Promise<RegenerateAllFlaggedStorageFileGroupsContentResult> {
    const instance = await this.testContext.storageFileServerActions.regenerateAllFlaggedStorageFileGroupsContent({});
    return instance();
  }

  async processZipFileRegeneration(): Promise<StorageFileDocument> {
    const storageFileGroup = await assertSnapshotData(this.document);
    const zipStorageFileDocument = this.testContext.demoFirestoreCollections.storageFileCollection.documentAccessor().loadDocumentForId(storageFileGroup.zsf as string);

    const processStorageFileInstance = await this.testContext.storageFileServerActions.processStorageFile({
      key: zipStorageFileDocument.key,
      processAgainIfSuccessful: true,
      runImmediately: true
    });

    await processStorageFileInstance(zipStorageFileDocument);
    return zipStorageFileDocument;
  }
}

export const demoStorageFileGroupContextFactory = () =>
  modelTestContextFactory<
    StorageFileGroup,
    StorageFileGroupDocument,
    DemoApiStorageFileGroupTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiStorageFileGroupTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiStorageFileGroupTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    StorageFileGroupFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiStorageFileGroupTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.storageFileGroupCollection,
    collectionForDocument: (fi, _doc) => fi.demoFirestoreCollections.storageFileGroupCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiStorageFileGroupTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, _p) => {
      let ref: StorageFileGroupDocument;

      if (params.storageFileGroupId) {
        const id = await getValueFromGetter(params.storageFileGroupId);
        ref = collection.documentAccessor().loadDocumentForId(id);
      } else {
        throw new Error('Must use storageFileGroupId to create a new reference, or use the "doc" parameter.');
      }

      return ref.documentRef;
    },
    initDocument: async (instance, params) => {
      const _p = instance.testContext;

      if (params.createIfNeeded === true || params.initIfNeeded === true) {
        const exists = await instance.document.exists();

        // create if it doesn't exist
        if (!exists) {
          await instance.createStorageFileGroup();
        }

        // initialize
        if (params.initIfNeeded === true) {
          await instance.initializeStorageFileGroup();
        }
      }
    }
  });

export const demoStorageFileGroupContext = demoStorageFileGroupContextFactory();

// MARK: UserExternalConnection
/**
 * Credentials for connecting a test user to a provider.
 *
 * The timestamps are relative to now rather than fixed, so the credentials are LIVE — a spec that
 * exercises the reader gets usable credentials without having to say so, and one that needs them
 * expired says so by overriding `expiresAt`.
 *
 * @param overrides - Values to apply over the defaults.
 * @returns Credentials to connect with.
 */
export function demoUserExternalConnectionTestCredentials(overrides: Partial<UserExternalConnectionCredentials> = {}): UserExternalConnectionCredentials {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + MS_IN_MINUTE * 30).toISOString(),
    scopes: ['booking:read'],
    externalAccountId: 'cal-123',
    label: 'user@example.com',
    ...overrides
  };
}

/**
 * Parameters for connecting a fixture's user to a provider, or for replacing that provider's
 * credentials after a refresh.
 *
 * The uid comes from the fixture, and the credentials default to
 * {@link demoUserExternalConnectionTestCredentials}.
 */
export type DemoApiUserExternalConnectionConnectTestParams = Omit<UserExternalConnectionConnectParams, 'uid' | 'credentials'> & {
  readonly credentials?: Maybe<UserExternalConnectionCredentials>;
};

export interface DemoApiUserExternalConnectionTestContextParams {
  readonly u: DemoApiAuthorizedUserTestContextFixture;
  /**
   * Whether or not to create the UserExternalConnection. Defaults to false.
   *
   * Only the public half is ever created here: the private half exists to hold credentials, and the
   * paired write creates it on the first connect.
   */
  readonly createIfNeeded?: boolean;
}

export class DemoApiUserExternalConnectionTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  UserExternalConnection,
  UserExternalConnectionDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiUserExternalConnectionTestContextInstance<F>
> {
  async loadUserExternalConnection(): Promise<Maybe<UserExternalConnection>> {
    return this.instance.loadUserExternalConnection();
  }

  async loadUserExternalConnectionPrivate(): Promise<Maybe<UserExternalConnectionPrivate>> {
    return this.instance.loadUserExternalConnectionPrivate();
  }

  async deleteUserExternalConnectionPrivate(): Promise<void> {
    return this.instance.deleteUserExternalConnectionPrivate();
  }

  async createUserExternalConnection(): Promise<UserExternalConnectionDocument> {
    return this.instance.createUserExternalConnection();
  }

  async connect(params: DemoApiUserExternalConnectionConnectTestParams): Promise<UserExternalConnectionDocument> {
    return this.instance.connect(params);
  }

  async refreshCredentials(params: DemoApiUserExternalConnectionConnectTestParams): Promise<UserExternalConnectionDocument> {
    return this.instance.refreshCredentials(params);
  }

  async markError(params: Omit<UserExternalConnectionMarkErrorParams, 'uid'>): Promise<UserExternalConnectionDocument> {
    return this.instance.markError(params);
  }

  async disconnect(params: Omit<UserExternalConnectionDisconnectParams, 'uid'>): Promise<UserExternalConnectionDocument> {
    return this.instance.disconnect(params);
  }

  async deleteAllUserExternalConnections(): Promise<void> {
    return this.instance.deleteAllUserExternalConnections();
  }
}

export class DemoApiUserExternalConnectionTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<UserExternalConnection, UserExternalConnectionDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Loads the client-readable half of the connection pair.
   *
   * @returns The UserExternalConnection, or undefined if it does not exist.
   */
  async loadUserExternalConnection(): Promise<Maybe<UserExternalConnection>> {
    return this.document.snapshotData();
  }

  /**
   * Loads the server-only half of the connection pair.
   *
   * The private collection is provided ONLY by the UserExternalConnectionModule, so it is reached
   * through the module's collections rather than the app's shared DemoFirestoreCollections.
   *
   * @returns The UserExternalConnectionPrivate, or undefined if it does not exist.
   */
  async loadUserExternalConnectionPrivate(): Promise<Maybe<UserExternalConnectionPrivate>> {
    return this.testContext.userExternalConnectionServerFirestoreCollections.userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(this.documentId).snapshotData();
  }

  /**
   * Deletes ONLY the server-only half of the pair.
   *
   * Deliberately reaches around {@link UserExternalConnectionServerActions}, which has no way to write
   * one half without the other. Exists to stage the half-written pair that no supported write can
   * produce, so a reader can be tested against it.
   */
  async deleteUserExternalConnectionPrivate(): Promise<void> {
    await this.testContext.userExternalConnectionServerFirestoreCollections.userExternalConnectionPrivateCollection.documentAccessor().loadDocumentForId(this.documentId).accessor.delete();
  }

  async createUserExternalConnection(): Promise<UserExternalConnectionDocument> {
    return this.testContext.userExternalConnectionServerActions.createUserExternalConnection({ uid: this.documentId });
  }

  async connect(params: DemoApiUserExternalConnectionConnectTestParams): Promise<UserExternalConnectionDocument> {
    return this.testContext.userExternalConnectionServerActions.connectUserExternalConnection({ ...params, credentials: params.credentials ?? demoUserExternalConnectionTestCredentials(), uid: this.documentId });
  }

  async refreshCredentials(params: DemoApiUserExternalConnectionConnectTestParams): Promise<UserExternalConnectionDocument> {
    return this.testContext.userExternalConnectionServerActions.refreshUserExternalConnectionCredentials({ ...params, credentials: params.credentials ?? demoUserExternalConnectionTestCredentials(), uid: this.documentId });
  }

  async markError(params: Omit<UserExternalConnectionMarkErrorParams, 'uid'>): Promise<UserExternalConnectionDocument> {
    return this.testContext.userExternalConnectionServerActions.markUserExternalConnectionError({ ...params, uid: this.documentId });
  }

  async disconnect(params: Omit<UserExternalConnectionDisconnectParams, 'uid'>): Promise<UserExternalConnectionDocument> {
    return this.testContext.userExternalConnectionServerActions.disconnectUserExternalConnection({ ...params, uid: this.documentId });
  }

  async deleteAllUserExternalConnections(): Promise<void> {
    return this.testContext.userExternalConnectionServerActions.deleteAllUserExternalConnectionsForUser({ uid: this.documentId });
  }
}

export const demoUserExternalConnectionContextFactory = () =>
  modelTestContextFactory<
    UserExternalConnection,
    UserExternalConnectionDocument,
    DemoApiUserExternalConnectionTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiUserExternalConnectionTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiUserExternalConnectionTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    UserExternalConnectionFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiUserExternalConnectionTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.userExternalConnectionCollection,
    collectionForDocument: (fi, _doc) => fi.demoFirestoreCollections.userExternalConnectionCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiUserExternalConnectionTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => {
      // the pair is keyed by the user's uid on both halves
      return collection.documentAccessor().documentRefForId(params.u.uid);
    },
    initDocument: async (instance, params) => {
      if (params.createIfNeeded === true) {
        const exists = await instance.document.exists();

        if (!exists) {
          await instance.createUserExternalConnection();
        }
      }
    }
  });

export const demoUserExternalConnectionContext = demoUserExternalConnectionContextFactory();

// MARK: UserExternalConnectionPrivate
/**
 * How the refresher a {@link DemoApiUserExternalConnectionPrivateTestContextInstance.testReader} is
 * built with should behave.
 */
export interface DemoApiUserExternalConnectionTestReaderConfig {
  /**
   * What the refresher resolves with. Omit for a reader with NO refresher at all; pass `'none'` for a
   * refresher that reports the provider has no refresh path.
   */
  readonly refreshResult?: UserExternalConnectionCredentials | 'none';
  /**
   * When set, the refresher rejects with this instead of resolving.
   */
  readonly refreshError?: Error;
  /**
   * Delays the refresher's resolution, so concurrent callers overlap.
   */
  readonly refreshDelayMs?: Milliseconds;
}

export interface DemoApiUserExternalConnectionTestReader {
  readonly reader: UserExternalConnectionReader;
  /**
   * Every input the refresher was called with.
   */
  readonly refreshInputs: UserExternalConnectionRefreshCredentialsInput[];
}

export interface DemoApiUserExternalConnectionPrivateTestContextParams {
  readonly u: DemoApiAuthorizedUserTestContextFixture;
}

export class DemoApiUserExternalConnectionPrivateTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  UserExternalConnectionPrivate,
  UserExternalConnectionPrivateDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiUserExternalConnectionPrivateTestContextInstance<F>
> {
  testReader(config: DemoApiUserExternalConnectionTestReaderConfig = {}): DemoApiUserExternalConnectionTestReader {
    return this.instance.testReader(config);
  }

  readerFor(reader: UserExternalConnectionReader, providerType?: UserExternalConnectionProviderType): UserExternalConnectionReaderProviderInstance {
    return this.instance.readerFor(reader, providerType);
  }

  appReaderFor(providerType?: UserExternalConnectionProviderType): UserExternalConnectionReaderProviderInstance {
    return this.instance.appReaderFor(providerType);
  }
}

export class DemoApiUserExternalConnectionPrivateTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<UserExternalConnectionPrivate, UserExternalConnectionPrivateDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Builds a reader over the app's REAL accessor and server actions, with a refresher this test
   * controls.
   *
   * The reader's policy — what counts as usable, when to renew, what to persist, what to record on a
   * failure — is only meaningful in terms of what ends up in the two documents, so it is worth
   * exercising against the emulator-backed pair rather than over stubs. The ONE thing faked here is the
   * provider's token exchange, which cannot be real in a test at all; {@link appReaderFor} is the app's
   * own reader, wired to the registry-backed refresher, for wherever the refresh outcome does not need
   * to be steered.
   *
   * @param config - How the refresher should behave. Omit it entirely for a reader with none.
   * @returns The reader plus every input its refresher saw.
   */
  testReader(config: DemoApiUserExternalConnectionTestReaderConfig = {}): DemoApiUserExternalConnectionTestReader {
    const { refreshResult, refreshError, refreshDelayMs } = config;
    const refreshInputs: UserExternalConnectionRefreshCredentialsInput[] = [];
    let refresher: Maybe<UserExternalConnectionCredentialsRefresher>;

    if (refreshResult != null || refreshError != null) {
      refresher = {
        refreshUserExternalConnectionCredentials: async (input) => {
          refreshInputs.push(input);

          if (refreshDelayMs != null) {
            await waitForMs(refreshDelayMs);
          }

          if (refreshError != null) {
            throw refreshError;
          }

          return refreshResult === 'none' ? null : refreshResult;
        }
      };
    }

    const reader = userExternalConnectionReader({
      accessor: this.testContext.userExternalConnectionAccessor,
      actions: this.testContext.userExternalConnectionServerActions,
      refresher
    });

    return { reader, refreshInputs };
  }

  /**
   * Narrows a reader to this fixture's user and one provider.
   *
   * @param reader - The reader to narrow. A {@link testReader} one, or the app's own.
   * @param providerType - The provider to target. Defaults to `calcom`.
   * @returns That reader for this user and provider.
   */
  readerFor(reader: UserExternalConnectionReader, providerType: UserExternalConnectionProviderType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE): UserExternalConnectionReaderProviderInstance {
    return reader.readerForUser({ uid: this.documentId })(providerType);
  }

  /**
   * {@link readerFor} over the app's own reader, which is wired to the registry-backed refresher.
   *
   * @param providerType - The provider to target. Defaults to `calcom`.
   * @returns The app's reader for this user and provider.
   */
  appReaderFor(providerType?: UserExternalConnectionProviderType): UserExternalConnectionReaderProviderInstance {
    return this.readerFor(this.testContext.userExternalConnectionReader, providerType);
  }
}

/**
 * Context over the SERVER-ONLY half of a user's connection pair.
 *
 * Separate from {@link demoUserExternalConnectionContext} because the two halves are not
 * interchangeable: that context is the client-readable document and the write surface that maintains
 * it, while this one is the encrypted credentials document — and therefore the natural home for the
 * readers, which exist to get credentials out of it.
 *
 * The document is NOT created here. It only ever comes into being through the paired write, so a spec
 * stages it by connecting a provider through the public context.
 *
 * @returns The context factory to wrap a spec's tests with.
 */
export const demoUserExternalConnectionPrivateContextFactory = () =>
  modelTestContextFactory<
    UserExternalConnectionPrivate,
    UserExternalConnectionPrivateDocument,
    DemoApiUserExternalConnectionPrivateTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiUserExternalConnectionPrivateTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiUserExternalConnectionPrivateTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    UserExternalConnectionPrivateFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiUserExternalConnectionPrivateTestContextFixture(f),
    getCollection: (fi) => fi.userExternalConnectionServerFirestoreCollections.userExternalConnectionPrivateCollection,
    collectionForDocument: (fi, _doc) => fi.userExternalConnectionServerFirestoreCollections.userExternalConnectionPrivateCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiUserExternalConnectionPrivateTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => {
      // keyed by the user's uid, the same as the public half
      return collection.documentAccessor().documentRefForId(params.u.uid);
    }
  });

export const demoUserExternalConnectionPrivateContext = demoUserExternalConnectionPrivateContextFactory();

// MARK: OpenRouterPrompt
/**
 * Default key {@link demoOpenRouterPromptContext} creates its prompt under.
 */
export const DEMO_API_TEST_OPENROUTER_PROMPT_KEY: OpenRouterPromptKey = 'test-prompt';

/**
 * Default system prompt {@link demoOpenRouterPromptVersionContext} publishes with.
 */
export const DEMO_API_TEST_OPENROUTER_PROMPT_INSTRUCTIONS = 'You are a test.';

/**
 * Default model config {@link demoOpenRouterPromptVersionContext} publishes with.
 *
 * A pinned single-provider config rather than a bare model id: config validation refuses a version that
 * names no model, so a fixture default has to be one that passes cleanly and raises no warnings.
 */
export const DEMO_API_TEST_OPENROUTER_MODEL_CONFIG: OpenRouterModelConfig = { model: 'openai/gpt-5.1', provider: { only: ['openai'], allowFallbacks: false, requireParameters: true } };

export interface DemoApiOpenRouterPromptTestContextParams {
  /**
   * The prompt key, which is also the document id. Defaults to {@link DEMO_API_TEST_OPENROUTER_PROMPT_KEY}.
   */
  readonly key?: Maybe<OpenRouterPromptKey>;
  /**
   * Human-readable name. Defaults to the key.
   */
  readonly name?: Maybe<string>;
  /**
   * Whether to create the prompt. Defaults to true.
   *
   * False addresses the key without writing anything, which is how a seed spec stages the prompt the
   * seed itself is deciding whether to create.
   */
  readonly create?: Maybe<boolean>;
}

/**
 * Params for {@link DemoApiOpenRouterPromptTestContextInstance.seed}.
 */
export interface DemoApiSeedOpenRouterPromptsParams extends SeedOpenRouterPromptsParams {
  /**
   * Registry to seed instead of the one the app ships.
   */
  readonly definitions?: Maybe<OpenRouterPromptDefinition[]>;
}

export class DemoApiOpenRouterPromptTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  OpenRouterPrompt,
  OpenRouterPromptDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiOpenRouterPromptTestContextInstance<F>
> {
  async loadPrompt(): Promise<OpenRouterPrompt> {
    return this.instance.loadPrompt();
  }

  versionDocument(version: OpenRouterPromptVersionNumber): OpenRouterPromptVersionDocument {
    return this.instance.versionDocument(version);
  }

  async loadVersion(version: OpenRouterPromptVersionNumber): Promise<Maybe<OpenRouterPromptVersion>> {
    return this.instance.loadVersion(version);
  }

  async update(params: Omit<UpdateOpenRouterPromptParams, 'key'>): Promise<void> {
    return this.instance.update(params);
  }

  async createVersion(params: Omit<CreateOpenRouterPromptVersionParams, 'prompt'>): Promise<CreateOpenRouterPromptVersionResult> {
    return this.instance.createVersion(params);
  }

  async seed(params?: DemoApiSeedOpenRouterPromptsParams): Promise<SeedOpenRouterPromptsResult> {
    return this.instance.seed(params);
  }
}

export class DemoApiOpenRouterPromptTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<OpenRouterPrompt, OpenRouterPromptDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * Reads the prompt back, asserting it exists.
   *
   * @returns The prompt.
   */
  async loadPrompt(): Promise<OpenRouterPrompt> {
    return assertSnapshotData(this.document);
  }

  /**
   * The document for one of this prompt's versions, which need not have been published.
   *
   * @param version - The version number.
   * @returns The version document.
   */
  versionDocument(version: OpenRouterPromptVersionNumber): OpenRouterPromptVersionDocument {
    return this.testContext.demoFirestoreCollections.openRouterPromptVersionCollectionFactory(this.document).documentAccessor().loadDocumentForId(openRouterPromptVersionId(version));
  }

  /**
   * Reads one of this prompt's versions, which need not have been published.
   *
   * @param version - The version number.
   * @returns The version, or undefined when that number was never published.
   */
  async loadVersion(version: OpenRouterPromptVersionNumber): Promise<Maybe<OpenRouterPromptVersion>> {
    return this.versionDocument(version).snapshotData();
  }

  /**
   * Updates the prompt through the server action, which is the surface an operator edits it through.
   *
   * @param params - The update, keyed automatically.
   */
  async update(params: Omit<UpdateOpenRouterPromptParams, 'key'>): Promise<void> {
    const updateOpenRouterPrompt = await this.testContext.openRouterPromptServerActions.updateOpenRouterPrompt({ ...params, key: this.documentKey });
    await updateOpenRouterPrompt(this.document);
  }

  /**
   * Publishes a new version through the server action, allocating its number.
   *
   * @param params - The version to create, keyed automatically.
   * @returns What was created.
   */
  async createVersion(params: Omit<CreateOpenRouterPromptVersionParams, 'prompt'>): Promise<CreateOpenRouterPromptVersionResult> {
    const createOpenRouterPromptVersion = await this.testContext.openRouterPromptServerActions.createOpenRouterPromptVersion({ ...params, prompt: this.documentKey });
    return createOpenRouterPromptVersion(this.document);
  }

  /**
   * Runs the prompt seed.
   *
   * Uncurried on purpose — the seed has no target document, which is why it hangs off a context staged
   * with `create: false`: the prompt it writes is the one it is deciding whether to create.
   *
   * With no `definitions` this is the app's own action over the registry it ships, which is the run a
   * deploy performs. With them it is the same wiring over a different registry — the collections, the
   * firestore context, and the actions context all stay the app's real instances — which is what lets a
   * spec seed the shipped prompts at a version the app does not currently declare.
   *
   * @param params - The seed params, plus the registry to read.
   * @returns What the run did.
   */
  async seed(params?: DemoApiSeedOpenRouterPromptsParams): Promise<SeedOpenRouterPromptsResult> {
    const { definitions, ...seedParams } = params ?? {};
    let actions = this.testContext.openRouterPromptServerActions;

    if (definitions != null) {
      const actionsContext = this.testContext.serverActionsContext;
      const promptService = openRouterPromptService({ collections: actionsContext, cacheDuration: 1, definitions });
      actions = openRouterPromptServerActions({ ...actionsContext, openRouterPromptService: promptService });
    }

    return actions.seedOpenRouterPrompts(seedParams);
  }
}

/**
 * Context over one OpenRouterPrompt, created through the server action.
 *
 * A prompt has no `create` on the model API — it comes into existence server-side, from a seed or an
 * operator — so the document is staged through {@link OpenRouterPromptServerActions} rather than a
 * callable.
 *
 * @returns The context factory to wrap a spec's tests with.
 */
export const demoOpenRouterPromptContextFactory = () =>
  modelTestContextFactory<
    OpenRouterPrompt,
    OpenRouterPromptDocument,
    DemoApiOpenRouterPromptTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiOpenRouterPromptTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiOpenRouterPromptTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    OpenRouterPromptFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiOpenRouterPromptTestContextFixture(f),
    getCollection: (fi) => fi.demoFirestoreCollections.openRouterPromptCollection,
    collectionForDocument: (fi, _doc) => fi.demoFirestoreCollections.openRouterPromptCollection,
    makeInstance: (delegate, ref, testInstance) => new DemoApiOpenRouterPromptTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params, p) => {
      const key = params.key ?? DEMO_API_TEST_OPENROUTER_PROMPT_KEY;
      let documentRef: DocumentReference<OpenRouterPrompt>;

      if (params.create === false) {
        documentRef = collection.documentAccessor().documentRefForId(key);
      } else {
        const document = await p.openRouterPromptServerActions.createOpenRouterPrompt({ key, name: params.name ?? key });
        documentRef = document.documentRef;
      }

      return documentRef;
    }
  });

export const demoOpenRouterPromptContext = demoOpenRouterPromptContextFactory();

// MARK: OpenRouterPromptVersion
export interface DemoApiOpenRouterPromptVersionTestContextParams extends Partial<Omit<CreateOpenRouterPromptVersionParams, 'prompt'>> {
  /**
   * The prompt the version belongs to.
   */
  readonly p: DemoApiOpenRouterPromptTestContextFixture;
  /**
   * Address this version number instead of publishing a new version.
   *
   * A separate param rather than an override of the published number, because a create ALLOCATES from
   * the prompt's `lv` — so the number a publish lands on cannot be named before the write, and a
   * caller that wants a specific number wants one nothing is going to write.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
}

export class DemoApiOpenRouterPromptVersionTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<
  OpenRouterPromptVersion,
  OpenRouterPromptVersionDocument,
  DemoApiFunctionContextFixtureInstance<F>,
  DemoApiFunctionContextFixture<F>,
  DemoApiOpenRouterPromptVersionTestContextInstance<F>
> {
  get version(): OpenRouterPromptVersionNumber {
    return this.instance.version;
  }

  async loadVersion(): Promise<OpenRouterPromptVersion> {
    return this.instance.loadVersion();
  }

  async update(params: Omit<UpdateOpenRouterPromptVersionParams, 'key'>): Promise<UpdateOpenRouterPromptVersionResult> {
    return this.instance.update(params);
  }
}

export class DemoApiOpenRouterPromptVersionTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<OpenRouterPromptVersion, OpenRouterPromptVersionDocument, DemoApiFunctionContextFixtureInstance<F>> {
  /**
   * The version number, read off the document id.
   *
   * Available without a read because the id IS the number, zero-padded so the collection sorts.
   *
   * @returns The version number.
   */
  get version(): OpenRouterPromptVersionNumber {
    return openRouterPromptVersionNumberFromId(this.documentId);
  }

  /**
   * Reads the version back, asserting it exists.
   *
   * @returns The version.
   */
  async loadVersion(): Promise<OpenRouterPromptVersion> {
    return assertSnapshotData(this.document);
  }

  /**
   * Edits the version in place through the server action, which refuses a locked one.
   *
   * @param params - The edit, keyed automatically.
   * @returns The validation warnings the edit raised.
   */
  async update(params: Omit<UpdateOpenRouterPromptVersionParams, 'key'>): Promise<UpdateOpenRouterPromptVersionResult> {
    const updateOpenRouterPromptVersion = await this.testContext.openRouterPromptServerActions.updateOpenRouterPromptVersion({ ...params, key: this.documentKey });
    return updateOpenRouterPromptVersion(this.document);
  }
}

/**
 * Context over one OpenRouterPromptVersion under a {@link demoOpenRouterPromptContext} prompt.
 *
 * Publishes a version by default, at whatever number the prompt's allocator hands it — pass `version`
 * to address a specific number instead, which is how a spec stages a version that was never published.
 *
 * @returns The context factory to wrap a spec's tests with.
 */
export const demoOpenRouterPromptVersionContextFactory = () =>
  modelTestContextFactory<
    OpenRouterPromptVersion,
    OpenRouterPromptVersionDocument,
    DemoApiOpenRouterPromptVersionTestContextParams,
    DemoApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>,
    DemoApiOpenRouterPromptVersionTestContextInstance<FirebaseAdminFunctionTestContextInstance>,
    DemoApiOpenRouterPromptVersionTestContextFixture<FirebaseAdminFunctionTestContextInstance>,
    OpenRouterPromptVersionFirestoreCollection
  >({
    makeFixture: (f) => new DemoApiOpenRouterPromptVersionTestContextFixture(f),
    getCollection: (fi, params) => fi.demoFirestoreCollections.openRouterPromptVersionCollectionFactory(params.p.document),
    collectionForDocument: (fi, doc) => {
      const parent = fi.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocument(doc.parent);
      return fi.demoFirestoreCollections.openRouterPromptVersionCollectionFactory(parent);
    },
    makeInstance: (delegate, ref, testInstance) => new DemoApiOpenRouterPromptVersionTestContextInstance(delegate, ref, testInstance),
    makeRef: async (collection, params) => {
      let version: OpenRouterPromptVersionNumber;

      if (params.version == null) {
        // Through the prompt's own createVersion, so the number comes from the same allocator every
        // other publisher uses rather than one this fixture picked.
        const created = await params.p.createVersion({ instructions: params.instructions ?? DEMO_API_TEST_OPENROUTER_PROMPT_INSTRUCTIONS, messages: params.messages, config: params.config ?? (DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as Record<string, unknown>), notes: params.notes, activate: params.activate });
        version = created.version;
      } else {
        version = params.version;
      }

      return collection.documentAccessor().documentRefForId(openRouterPromptVersionId(version));
    }
  });

export const demoOpenRouterPromptVersionContext = demoOpenRouterPromptVersionContextFactory();

// MARK: Oidc
/**
 * Factory that performs a full OAuth authorization code flow for demo-api tests.
 *
 * Scopes are auto-resolved from `OidcAccountService.providerConfig.claims`.
 */
export const demoOAuthAuthorizedSuperTestContext = oAuthAuthorizedSuperTestContextFactory();
