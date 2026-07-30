/**
 * @module notification.api
 *
 * API parameter types, Arktype validation schemas, and Firebase function definitions for the notification CRUD operations.
 *
 * Each param interface has a corresponding Arktype validator (e.g., {@link updateNotificationUserParamsType}).
 * The {@link NotificationFunctions} abstract class defines the client-callable function map.
 */
import { type, type Type } from 'arktype';
import { type TargetModelParams, type FirestoreModelKey, type FirebaseAuthUserId } from '../../common';
import { firestoreModelIdType, firestoreModelKeyType } from '../../common/model/model/model.validator';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type E164PhoneNumber, type EmailAddress, type IndexNumber, type Maybe } from '@dereekb/util';
import { type NotificationTypes } from './notification';
import { type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationBoxRecipientTemplateConfigArrayEntry, NotificationBoxRecipientFlag } from './notification.config';
import { type NotificationBoxId, type NotificationSummaryId, type NotificationTemplateType } from './notification.id';
import { ARKTYPE_DATE_DTO_TYPE, clearable, e164PhoneNumberType } from '@dereekb/model';
import { type NotificationHealthCheck, NotificationDeliveryMethod } from './notification.healthcheck';
import { type NotificationSendEmailMessagesResult, type NotificationSendTextMessagesResult, type NotificationSendNotificationSummaryMessagesResult } from './notification.send';
import { type NotificationTaskServiceTaskHandlerCompletionType } from './notification.task';

export const NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH = 0;
export const NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH = 42;

export const NOTIFICATION_SUBJECT_MIN_LENGTH = 2;
export const NOTIFICATION_SUBJECT_MAX_LENGTH = 100;

export const NOTIFICATION_MESSAGE_MIN_LENGTH = 2;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

/**
 * Config entries are inserted, unless marked as remove.
 */
export interface NotificationBoxRecipientTemplateConfigArrayEntryParam extends NotificationBoxRecipientTemplateConfigArrayEntry {
  readonly type: NotificationTemplateType;
  readonly sd?: Maybe<boolean>;
  readonly se?: Maybe<boolean>;
  readonly st?: Maybe<boolean>;
  readonly sp?: Maybe<boolean>;
  readonly sn?: Maybe<boolean>;
  readonly remove?: Maybe<boolean>;
}

export const notificationBoxRecipientTemplateConfigArrayEntryParamType = /* @__PURE__ */ type({
  type: 'string > 0',
  'sd?': clearable('boolean'),
  'se?': clearable('boolean'),
  'st?': clearable('boolean'),
  'sp?': clearable('boolean'),
  'sn?': clearable('boolean'),
  'remove?': clearable('boolean')
});

/**
 * Used for creating a new NotificationUser for a user.
 */
export interface CreateNotificationUserParams {
  readonly uid: FirebaseAuthUserId;
}

export const createNotificationUserParamsType = /* @__PURE__ */ type({
  uid: firestoreModelIdType
}) as Type<CreateNotificationUserParams>;

/**
 * Used for updating the global or default config on a NotificationUser.
 */
export interface UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams extends Omit<NotificationUserDefaultNotificationBoxRecipientConfig, 'c'> {
  readonly i?: Maybe<IndexNumber>;
  readonly e?: Maybe<EmailAddress>;
  readonly t?: Maybe<E164PhoneNumber>;
  readonly configs?: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;
  readonly lk?: Maybe<boolean>;
  readonly bk?: Maybe<boolean>;
  readonly f?: Maybe<NotificationBoxRecipientFlag>;
}

export const updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType = /* @__PURE__ */ type({
  'i?': clearable('number'),
  'e?': clearable('string.email'),
  't?': clearable(e164PhoneNumberType),
  'configs?': clearable(notificationBoxRecipientTemplateConfigArrayEntryParamType.array()),
  'lk?': clearable('boolean'),
  'bk?': clearable('boolean'),
  'f?': clearable(type.enumerated(NotificationBoxRecipientFlag.ENABLED, NotificationBoxRecipientFlag.DISABLED, NotificationBoxRecipientFlag.OPT_OUT))
}) as Type<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;

export interface UpdateNotificationBoxRecipientLikeParams {
  readonly e?: Maybe<EmailAddress>;
  readonly t?: Maybe<E164PhoneNumber>;
  readonly s?: Maybe<NotificationSummaryId>;
  readonly configs?: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;
}

export const updateNotificationBoxRecipientLikeParamsType = /* @__PURE__ */ type({
  'e?': clearable('string.email'),
  't?': clearable(e164PhoneNumberType),
  's?': clearable('string'),
  'configs?': clearable(notificationBoxRecipientTemplateConfigArrayEntryParamType.array())
}) as Type<UpdateNotificationBoxRecipientLikeParams>;

/**
 * Used for updating the target NotificationUserNotificationBoxRecipientConfig.
 */
export interface UpdateNotificationUserNotificationBoxRecipientParams extends UpdateNotificationBoxRecipientLikeParams {
  readonly nb: NotificationBoxId;
  readonly rm?: Maybe<boolean>;
  readonly lk?: Maybe<boolean>;
  readonly bk?: Maybe<boolean>;
  readonly f?: Maybe<NotificationBoxRecipientFlag>;
  readonly deleteRemovedConfig?: Maybe<boolean>;
}

export const updateNotificationUserNotificationBoxRecipientParamsType = updateNotificationBoxRecipientLikeParamsType.merge({
  nb: firestoreModelIdType,
  'rm?': clearable('boolean'),
  'lk?': clearable('boolean'),
  'bk?': clearable('boolean'),
  'f?': clearable(type.enumerated(NotificationBoxRecipientFlag.ENABLED, NotificationBoxRecipientFlag.DISABLED, NotificationBoxRecipientFlag.OPT_OUT)),
  'deleteRemovedConfig?': clearable('boolean')
}) as Type<UpdateNotificationUserNotificationBoxRecipientParams>;

/**
 * Used for updating the NotificationUser.
 */
export interface UpdateNotificationUserParams extends TargetModelParams {
  readonly gc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;
  readonly dc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;
  readonly bc?: Maybe<UpdateNotificationUserNotificationBoxRecipientParams[]>;
}

export const updateNotificationUserParamsType = targetModelParamsType.merge({
  'gc?': clearable(updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType),
  'dc?': clearable(updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType),
  'bc?': clearable(updateNotificationUserNotificationBoxRecipientParamsType.array())
}) as Type<UpdateNotificationUserParams>;

export type ResyncNotificationUserParams = TargetModelParams;

export { targetModelParamsType as resyncNotificationUserParamsType } from '../../common/model/model/model.param';

export interface ResyncNotificationUserResult {
  readonly notificationBoxesUpdated: number;
}

/**
 * Used for running a notification delivery health check for a user.
 *
 * The check always inspects the user's configuration, their notification box subscriptions, and whatever
 * read-only diagnostics each configured delivery method's send service offers. Actually dispatching a
 * test message is opt-in via `sendProbe`, since that delivers real mail/SMS to the user.
 */
export interface NotificationUserHealthCheckParams extends TargetModelParams {
  /**
   * Restrict the check to these delivery methods. Defaults to every method the server has a send
   * service configured for.
   */
  readonly methods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Dispatch a real test message through each checked method that supports probing.
   *
   * Defaults to false. Delivery confirmation is asynchronous, so a dispatched probe is usually still
   * pending when the check returns and is resolved by a later run.
   */
  readonly sendProbe?: Maybe<boolean>;
  /**
   * Only resolve probes left pending by the previous check, skipping the configuration, history, and
   * provider diagnostics.
   *
   * Defaults to false. Used for cheaply polling an in-flight probe.
   */
  readonly verifyPendingProbesOnly?: Maybe<boolean>;
  /**
   * The notification template type to evaluate per-template configuration against.
   *
   * Defaults to the app's default template type.
   */
  readonly notificationTemplateType?: Maybe<NotificationTemplateType>;
  /**
   * Skip inspecting the user's notification box subscriptions.
   *
   * Defaults to false. Skipping avoids a document read per subscription, at the cost of not detecting
   * a subscription that is broken, still being set up, or out of sync with the user's settings.
   */
  readonly skipSubscriptionChecks?: Maybe<boolean>;
  /**
   * Ignore the run and test message throttle windows.
   *
   * PRIVILEGED — admin only. The windows exist to stop a user from repeatedly hammering the delivery
   * providers and their own inbox, so this must never be honoured for an ordinary caller. The action
   * itself cannot tell who is calling, so the API layer that can is responsible for clearing this
   * before the params reach it:
   *
   * ```ts
   * const params = isAdminInRequest(request) ? data : { ...data, force: undefined };
   * ```
   *
   * Defaults to false.
   */
  readonly force?: Maybe<boolean>;
  /**
   * Return the complete health check rather than just the part the call was about.
   *
   * A `sendProbe` call is about one delivery method's test message, so by default its result carries only
   * the methods it actually probed — the caller already has the rest, and a client rendering the report
   * reads it from the {@link NotificationUser} document instead. Set this to get the whole check back.
   *
   * Defaults to false. Has no effect on a plain run, which always returns everything, and never affects
   * what is persisted: the stored check is always the complete picture.
   */
  readonly returnFullHealthCheck?: Maybe<boolean>;
}

export const notificationUserHealthCheckParamsType = targetModelParamsType.merge({
  'methods?': clearable(type.enumerated(NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.PUSH, NotificationDeliveryMethod.NOTIFICATION_SUMMARY).array()),
  'sendProbe?': clearable('boolean'),
  'verifyPendingProbesOnly?': clearable('boolean'),
  'notificationTemplateType?': clearable('string > 0'),
  'skipSubscriptionChecks?': clearable('boolean'),
  'force?': clearable('boolean'),
  'returnFullHealthCheck?': clearable('boolean')
}) as Type<NotificationUserHealthCheckParams>;

/**
 * The result of a `healthCheck` invocation.
 */
export interface NotificationUserHealthCheckResult {
  /**
   * The health check that was produced.
   *
   * The COMPLETE check is always persisted to the {@link NotificationUser}'s `hc` field. What comes back
   * here can be narrower: a `sendProbe` call is about one delivery method's test message, so unless
   * `returnFullHealthCheck` was set its result carries only the methods that were actually probed, with
   * `s` rolled up over just those and the account-wide findings left out. Read the document for the
   * whole picture — see {@link NotificationUserHealthCheckParams.returnFullHealthCheck}.
   */
  readonly healthCheck: NotificationHealthCheck;
  /**
   * The number of probes dispatched by this run.
   */
  readonly probesDispatched: number;
  /**
   * The number of previously-pending probes this run resolved to a final status.
   */
  readonly probesResolved: number;
}

export interface ResyncAllNotificationUserParams {}

export const resyncAllNotificationUserParamsType = /* @__PURE__ */ type({}) as Type<ResyncAllNotificationUserParams>;

export interface ResyncAllNotificationUsersResult extends ResyncNotificationUserResult {
  readonly notificationUsersResynced: number;
}

/**
 * Used for creating a new NotificationSummary for a model.
 */
export interface CreateNotificationSummaryParams {
  readonly model: FirestoreModelKey;
}

export const createNotificationSummaryParamsType = /* @__PURE__ */ type({
  model: firestoreModelKeyType
}) as Type<CreateNotificationSummaryParams>;

/**
 * Used for updating the NotificationSummary.
 */
export interface UpdateNotificationSummaryParams extends TargetModelParams {
  readonly flagAllRead?: Maybe<boolean>;
  readonly setReadAtTime?: Maybe<Date>;
}

export const updateNotificationSummaryParamsType = targetModelParamsType.merge({
  'flagAllRead?': clearable('boolean'),
  'setReadAtTime?': clearable(ARKTYPE_DATE_DTO_TYPE)
}) as Type<UpdateNotificationSummaryParams>;

/**
 * Used for creating or initializing a new NotificationBox for a model.
 *
 * Mainly used for testing. Not exposed to the API.
 *
 * The preferred way is to create a NotificationBox through a Notification.
 */
export interface CreateNotificationBoxParams {
  readonly model: FirestoreModelKey;
}

export const createNotificationBoxParamsType = /* @__PURE__ */ type({
  model: firestoreModelKeyType
}) as Type<CreateNotificationBoxParams>;

/**
 * Used for initializing an uninitialized model like NotificationBox or NotificationSummary.
 */
export interface InitializeNotificationModelParams extends TargetModelParams {
  readonly throwErrorIfAlreadyInitialized?: boolean;
}

export const initializeNotificationModelParamsType = targetModelParamsType.merge({
  'throwErrorIfAlreadyInitialized?': clearable('boolean')
}) as Type<InitializeNotificationModelParams>;

export interface InitializeAllApplicableNotificationBoxesParams {}

export const initializeAllApplicableNotificationBoxesParamsType = /* @__PURE__ */ type({}) as Type<InitializeAllApplicableNotificationBoxesParams>;

export interface InitializeAllApplicableNotificationBoxesResult {
  readonly notificationBoxesVisited: number;
  readonly notificationBoxesSucceeded: number;
  readonly notificationBoxesFailed: number;
  readonly notificationBoxesAlreadyInitialized: number;
}

export interface InitializeAllApplicableNotificationSummariesParams {}

export const initializeAllApplicableNotificationSummariesParamsType = /* @__PURE__ */ type({}) as Type<InitializeAllApplicableNotificationSummariesParams>;

export interface InitializeAllApplicableNotificationSummariesResult {
  readonly notificationSummariesVisited: number;
  readonly notificationSummariesSucceeded: number;
  readonly notificationSummariesFailed: number;
  readonly notificationSummariesAlreadyInitialized: number;
}

/**
 * Used for updating the NotificationBox.
 */
export type UpdateNotificationBoxParams = TargetModelParams;

export { targetModelParamsType as updateNotificationBoxParamsType } from '../../common/model/model/model.param';

/**
 * Used to create/update a notification box recipient.
 */
export interface UpdateNotificationBoxRecipientParams extends UpdateNotificationBoxRecipientLikeParams, TargetModelParams {
  readonly key: FirestoreModelKey;
  readonly i?: Maybe<IndexNumber>;
  readonly uid?: Maybe<FirebaseAuthUserId>;
  readonly insert?: Maybe<boolean>;
  readonly enabled?: Maybe<boolean>;
  readonly remove?: Maybe<boolean>;
  readonly setExclusion?: Maybe<boolean>;
}

export const updateNotificationBoxRecipientParamsType = updateNotificationBoxRecipientLikeParamsType.merge({
  key: firestoreModelKeyType,
  'i?': clearable('number'),
  'uid?': clearable(firestoreModelIdType),
  'insert?': clearable('boolean'),
  'enabled?': clearable('boolean'),
  'remove?': clearable('boolean'),
  'setExclusion?': clearable('boolean')
}) as Type<UpdateNotificationBoxRecipientParams>;

export interface NotificationRecipientParams {
  readonly uid?: Maybe<FirebaseAuthUserId>;
  readonly un?: Maybe<string>;
  readonly e?: Maybe<EmailAddress>;
  readonly p?: Maybe<E164PhoneNumber>;
}

export const notificationRecipientParamsType = /* @__PURE__ */ type({
  'uid?': clearable(firestoreModelIdType),
  'un?': clearable(`string >= ${NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH} & string <= ${NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH}`),
  'e?': clearable('string.email'),
  'p?': clearable('string')
}) as Type<NotificationRecipientParams>;

/**
 * Used for sending the notification immediately, if it has not already been sent.
 */
export interface SendNotificationParams extends TargetModelParams {
  readonly ignoreSendAtThrottle?: Maybe<boolean>;
  readonly throwErrorIfSent?: Maybe<boolean>;
}

export const sendNotificationParamsType = targetModelParamsType.merge({
  'ignoreSendAtThrottle?': clearable('boolean'),
  'throwErrorIfSent?': clearable('boolean')
}) as Type<SendNotificationParams>;

/**
 * Params class used for subscribing a system user to a NotificationBox for a model.
 */
export interface AbstractSubscribeToNotificationBoxParams extends TargetModelParams {
  readonly uid: FirebaseAuthUserId;
}

export const abstractSubscribeToNotificationBoxParamsType = targetModelParamsType.merge({
  uid: firestoreModelIdType
}) as Type<AbstractSubscribeToNotificationBoxParams>;

export interface AbstractSubscribeOrUnsubscribeToNotificationBoxParams extends AbstractSubscribeToNotificationBoxParams {
  readonly unsubscribe?: Maybe<boolean>;
}

export const abstractSubscribeOrUnsubscribeToNotificationBoxParamsType = abstractSubscribeToNotificationBoxParamsType.merge({
  'unsubscribe?': clearable('boolean')
}) as Type<AbstractSubscribeOrUnsubscribeToNotificationBoxParams>;

export interface SendNotificationResultOnSendCompleteResult<T = unknown> {
  readonly value?: T;
  readonly error?: Maybe<unknown>;
}

/**
 * Detailed result returned by the `sendNotification` function, describing the outcome of sending a single notification.
 */
export interface SendNotificationResult {
  readonly notificationTemplateType: Maybe<NotificationTemplateType>;
  readonly isKnownTemplateType: Maybe<boolean>;
  readonly isNotificationTask: boolean;
  /**
   * True if the notification was a logged-event record (`st === LOGGED_EVENT`). Logged events bypass
   * the send pipeline entirely; the factory short-circuits and returns immediately when one is loaded.
   */
  readonly isLoggedEvent: boolean;
  readonly isUniqueNotificationTask: boolean;
  readonly uniqueNotificationTaskConflict: boolean;
  readonly isConfiguredTemplateType: Maybe<boolean>;
  readonly throttled: boolean;
  readonly success: boolean;
  readonly notificationTaskCompletionType?: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
  readonly notificationTaskPartsRunCount?: Maybe<number>;
  readonly notificationTaskLoopingProtectionTriggered?: Maybe<boolean>;
  readonly notificationMarkedDone: boolean;
  readonly createdBox: boolean;
  readonly notificationBoxNeedsInitialization: boolean;
  readonly deletedNotification: boolean;
  readonly exists: boolean;
  readonly boxExists: boolean;
  readonly tryRun: boolean;
  readonly sendEmailsResult: Maybe<NotificationSendEmailMessagesResult>;
  readonly sendTextsResult: Maybe<NotificationSendTextMessagesResult>;
  readonly sendNotificationSummaryResult: Maybe<NotificationSendNotificationSummaryMessagesResult>;
  readonly loadMessageFunctionFailure: boolean;
  readonly buildMessageFailure: boolean;
  readonly onSendAttemptedResult?: Maybe<SendNotificationResultOnSendCompleteResult>;
  readonly onSendSuccessResult?: Maybe<SendNotificationResultOnSendCompleteResult>;
}

/**
 * Used for sending queued notifications in the system.
 */
export interface SendQueuedNotificationsParams {
  readonly maxSendNotificationLoops?: Maybe<number>;
  readonly maxParellelSendTasks?: Maybe<number>;
  readonly sendNotificationLoopsTaskExcessThreshold?: Maybe<number>;
}

export const sendQueuedNotificationsParamsType = /* @__PURE__ */ type({
  'maxSendNotificationLoops?': clearable('number'),
  'maxParellelSendTasks?': clearable('number'),
  'sendNotificationLoopsTaskExcessThreshold?': clearable('number')
}) as Type<SendQueuedNotificationsParams>;

/**
 * Aggregate result of processing the notification send queue, with counts of visited, succeeded, failed, and deleted notifications.
 */
export interface SendQueuedNotificationsResult extends Omit<
  SendNotificationResult,
  'throttled' | 'isNotificationTask' | 'isLoggedEvent' | 'isUniqueNotificationTask' | 'notificationTaskCompletionType' | 'uniqueNotificationTaskConflict' | 'isConfiguredTemplateType' | 'isKnownTemplateType' | 'notificationTemplateType' | 'notificationMarkedDone' | 'deletedNotification' | 'createdBox' | 'success' | 'exists' | 'boxExists' | 'notificationBoxNeedsInitialization' | 'tryRun' | 'loadMessageFunctionFailure' | 'buildMessageFailure'
> {
  readonly excessLoopsDetected: boolean;
  readonly notificationLoopCount: number;
  readonly notificationBoxesCreated: number;
  readonly notificationsVisited: number;
  readonly notificationTasksVisited: number;
  readonly notificationsSucceeded: number;
  readonly notificationsDelayed: number;
  readonly notificationsFailed: number;
  readonly notificationsDeleted: number;
}

/**
 * Used for sending queued notifications in the system.
 */
export interface CleanupSentNotificationsParams {}

export const cleanupSentNotificationsParamsType = /* @__PURE__ */ type({}) as Type<CleanupSentNotificationsParams>;

export interface CleanupSentNotificationsResult {
  readonly notificationBoxesUpdatesCount: number;
  readonly notificationTasksDeletedCount: number;
  readonly notificationsDeleted: number;
  readonly notificationWeeksCreated: number;
  readonly notificationWeeksUpdated: number;
  /**
   * Number of logged-event notifications archived to {@link NotificationLoggedEventDay} during cleanup.
   */
  readonly notificationLoggedEventsCleanedUp: number;
}

/**
 * Parameters for the `cleanupOldNotificationLoggedEventDays` action.
 */
export interface CleanupOldNotificationLoggedEventDaysParams {
  /**
   * Number of days of logged-event history to retain. Day documents whose ISO day string ID is older
   * than `now - retentionDays` are deleted along with their nested page subcollection.
   */
  readonly retentionDays: number;
}

export const cleanupOldNotificationLoggedEventDaysParamsType = /* @__PURE__ */ type({
  retentionDays: 'number>0'
}) as Type<CleanupOldNotificationLoggedEventDaysParams>;

/**
 * Aggregate result of the `cleanupOldNotificationLoggedEventDays` action.
 */
export interface CleanupOldNotificationLoggedEventDaysResult {
  /**
   * Number of {@link NotificationLoggedEventDay} wrapper documents deleted.
   */
  readonly daysDeleted: number;
  /**
   * Number of page documents (including the `_index` doc) deleted across all purged days.
   */
  readonly pagesDeleted: number;
}

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for notifications. Currently empty — all operations use the CRUD pattern.
 */
export type NotificationFunctionTypeMap = {};

export const NOTIFICATION_FUNCTION_TYPE_CONFIG_MAP: FirebaseFunctionTypeConfigMap<NotificationFunctionTypeMap> = {};

export type NotificationBoxModelCrudFunctionsConfig = {
  readonly notificationUser: {
    update: {
      _: UpdateNotificationUserParams;
      resync: [ResyncNotificationUserParams, ResyncNotificationUserResult];
    };
    invoke: {
      healthCheck: [NotificationUserHealthCheckParams, NotificationUserHealthCheckResult];
    };
  };
  readonly notificationSummary: {
    update: {
      _: UpdateNotificationSummaryParams;
    };
  };
  readonly notificationBox: {
    update: {
      _: UpdateNotificationBoxParams;
      recipient: UpdateNotificationBoxRecipientParams;
    };
  };
  readonly notification: {
    update: {
      send: [SendNotificationParams, SendNotificationResult];
    };
  };
  readonly notificationWeek: null;
  readonly notificationLoggedEventDay: null;
  readonly notificationLoggedEventDayPage: null;
};

export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync', 'invoke:healthCheck'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send']
};

/**
 * Abstract client-callable function map for notification CRUD operations.
 *
 * Implementations are generated by {@link notificationFunctionMap} for client-side use,
 * and by the server-side function registration in the demo-api or application module.
 */
export abstract class NotificationFunctions implements ModelFirebaseFunctionMap<NotificationFunctionTypeMap, NotificationBoxModelCrudFunctionsConfig> {
  abstract notificationUser: {
    updateNotificationUser: {
      update: ModelFirebaseCrudFunction<UpdateNotificationUserParams>;
      resync: ModelFirebaseCrudFunction<ResyncNotificationUserParams, ResyncNotificationUserResult>;
    };
    invokeNotificationUser: {
      healthCheck: ModelFirebaseCrudFunction<NotificationUserHealthCheckParams, NotificationUserHealthCheckResult>;
    };
  };
  abstract notificationSummary: {
    updateNotificationSummary: {
      update: ModelFirebaseCrudFunction<UpdateNotificationSummaryParams>;
    };
  };
  abstract notificationBox: {
    updateNotificationBox: {
      update: ModelFirebaseCrudFunction<UpdateNotificationBoxParams>;
      recipient: ModelFirebaseCrudFunction<UpdateNotificationBoxRecipientParams>;
    };
  };
  abstract notification: {
    updateNotification: {
      send: ModelFirebaseCrudFunction<SendNotificationParams, SendNotificationResult>;
    };
  };
}

/**
 * Factory for creating client-side callable function instances from the notification CRUD configuration.
 */
export const notificationFunctionMap = callModelFirebaseFunctionMapFactory(NOTIFICATION_FUNCTION_TYPE_CONFIG_MAP, NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG);
