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
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseReadFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type E164PhoneNumber, type EmailAddress, type IndexNumber, type Maybe } from '@dereekb/util';
import { type NotificationTypes } from './notification';
import { type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationBoxRecipientTemplateConfigArrayEntry, NotificationBoxRecipientFlag, NotificationDeliveryMethod } from './notification.config';
import {
  NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH,
  NOTIFICATION_TASK_BOT_ENTRY_ID_REGEX,
  NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_MAX_LENGTH,
  NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_REGEX,
  type NotificationBoxId,
  type NotificationSummaryId,
  type NotificationTaskBotEntryId,
  type NotificationTaskBotScriptGroupKey,
  type NotificationTaskKey,
  type NotificationTemplateType
} from './notification.id';
import { ARKTYPE_DATE_DTO_TYPE, clearable, e164PhoneNumberType } from '@dereekb/model';
import { type NotificationHealthCheck, type NotificationHealthCheckIssueAutofixResult, type NotificationHealthCheckIssueCode } from './notification.healthcheck';
import { type NotificationSendEmailMessagesResult, type NotificationSendTextMessagesResult, type NotificationSendNotificationSummaryMessagesResult } from './notification.send';
import { type NotificationTaskServiceTaskHandlerCompletionType } from './notification.task';
import { NotificationTaskBotEntryState, type NotificationTaskBotEntryStatus, NotificationTaskBotRunTrigger } from './notification.taskbot';
import { type NotificationTaskBotOwnerOptOutGroup } from './notification.taskbot.optout';

export const NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH = 0;
export const NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH = 42;

export const NOTIFICATION_SUBJECT_MIN_LENGTH = 2;
export const NOTIFICATION_SUBJECT_MAX_LENGTH = 100;

export const NOTIFICATION_MESSAGE_MIN_LENGTH = 2;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

/**
 * Arktype validator for a single {@link NotificationDeliveryMethod}.
 */
export const notificationDeliveryMethodType = /* @__PURE__ */ type.enumerated(NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.PUSH, NotificationDeliveryMethod.NOTIFICATION_SUMMARY);

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
 *
 * The server-managed `tcat` (text consent) field cannot be set by the client.
 */
export interface UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams extends Omit<NotificationUserDefaultNotificationBoxRecipientConfig, 'c' | 'tcat'> {
  readonly i?: Maybe<IndexNumber>;
  readonly e?: Maybe<EmailAddress>;
  readonly t?: Maybe<E164PhoneNumber>;
  readonly configs?: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;
  readonly lk?: Maybe<boolean>;
  readonly bk?: Maybe<boolean>;
  readonly f?: Maybe<NotificationBoxRecipientFlag>;
  /**
   * Delivery methods to disable account-wide.
   *
   * Undefined keeps the current list, null clears it, and an array replaces it.
   */
  readonly dm?: Maybe<NotificationDeliveryMethod[]>;
}

export const updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType = /* @__PURE__ */ type({
  'i?': clearable('number'),
  'e?': clearable('string.email'),
  't?': clearable(e164PhoneNumberType),
  'configs?': clearable(notificationBoxRecipientTemplateConfigArrayEntryParamType.array()),
  'lk?': clearable('boolean'),
  'bk?': clearable('boolean'),
  'f?': clearable(type.enumerated(NotificationBoxRecipientFlag.ENABLED, NotificationBoxRecipientFlag.DISABLED, NotificationBoxRecipientFlag.OPT_OUT)),
  'dm?': clearable(notificationDeliveryMethodType.array())
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
  /**
   * Opts the user out of the box, or back in.
   *
   * {@link NotificationBoxRecipientFlag.OPT_OUT} stops every notification from the box, whatever the user's global config (`gc`) sets per
   * template type. `null` or {@link NotificationBoxRecipientFlag.ENABLED} opts back in. {@link NotificationBoxRecipientFlag.DISABLED} belongs
   * to the box and is ignored, and a config the box has DISABLED is not changed. Undefined keeps the current flag.
   *
   * Like the other box config changes, it reaches the NotificationBox on the next resync, or right away with `resync`.
   */
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
 *
 * @dbxModelApiParams
 */
export interface UpdateNotificationUserParams extends TargetModelParams {
  readonly gc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;
  readonly dc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;
  readonly bc?: Maybe<UpdateNotificationUserNotificationBoxRecipientParams[]>;
  /**
   * Whether to sync the box configs this update leaves flagged (`ns`) to their NotificationBoxes right away, instead of waiting for
   * `resyncNotificationUser` / `resyncAllNotificationUsers`.
   *
   * Only the NotificationUser's own recipient entries are written. The sync is best-effort: a failed sync does not fail the update, and leaves
   * the configs flagged for the next resync. An app can turn it off by clearing it in its update handler, e.g. `{ ...data, resync: undefined }`.
   */
  readonly resync?: Maybe<boolean>;
}

export const updateNotificationUserParamsType = targetModelParamsType.merge({
  'gc?': clearable(updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType),
  'dc?': clearable(updateNotificationUserDefaultNotificationBoxRecipientConfigParamsType),
  'bc?': clearable(updateNotificationUserNotificationBoxRecipientParamsType.array()),
  'resync?': clearable('boolean')
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
 *
 * @dbxModelApiParams
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
   * pending when the check returns and is resolved by a later {@link verifyPendingProbesOnly} run.
   */
  readonly sendProbe?: Maybe<boolean>;
  /**
   * Only resolve probes left pending by the previous check, skipping the configuration, history, and
   * provider diagnostics.
   *
   * Defaults to false. This is the POLL that settles an in-flight test message, and it is deliberately
   * cheap enough to be called repeatedly: it consults a provider only for a method that actually has a
   * probe in flight, and touches nothing else. It answers to its own short window rather than the run
   * window, and advances the stored check's `vat` rather than its `at`, so polling a test message never
   * consumes the user's allowance for running the check itself.
   */
  readonly verifyPendingProbesOnly?: Maybe<boolean>;
  /**
   * The notification template type to evaluate per-template configuration against.
   *
   * Defaults to the app's default template type. The default template type cannot be configured in the notification settings, so
   * checking it evaluates every known template type instead, and a method's per-type configuration is only reported when no
   * notification type would send it.
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
  'methods?': clearable(notificationDeliveryMethodType.array()),
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

/**
 * Used for automatically fixing issues a notification delivery health check found for a user, such as
 * removing their address from a delivery provider's suppression list.
 *
 * PRIVILEGED — admin only. A fix changes state at the delivery provider, and can undo a choice the
 * recipient made, so the API layer must restrict who can call it:
 *
 * ```ts
 * assertIsAdminInRequest(request);
 * ```
 *
 * Only issues on the user's STORED health check can be fixed, and only those the reporting provider marked
 * as fixable (`af`). The fix is applied to the delivery target that check recorded, which is the one an
 * admin reviewing the check sees. The delivery method is checked again afterwards, so the result and the
 * stored check both show whether the fix worked.
 *
 * @dbxModelApiParams
 */
export interface NotificationUserHealthCheckAutofixParams extends TargetModelParams {
  /**
   * The delivery method whose issues to fix.
   */
  readonly method: NotificationDeliveryMethod;
  /**
   * The codes of the issues to fix. Each must be on the stored health check for this method and be marked
   * fixable, or the whole call is refused.
   */
  readonly codes: NotificationHealthCheckIssueCode[];
  /**
   * Allow fixing issues whose autofix is {@link NotificationHealthCheckIssueAutofixType.EXPLICIT}.
   *
   * Those fixes override a choice the recipient made, such as reporting a message as spam, so they are
   * refused unless this is set. Only set it when the recipient has explicitly asked for the fix.
   *
   * Defaults to false.
   */
  readonly allowExplicitAutofix?: Maybe<boolean>;
}

export const notificationUserHealthCheckAutofixParamsType = targetModelParamsType.merge({
  method: notificationDeliveryMethodType,
  codes: type('string > 0').array().atLeastLength(1),
  'allowExplicitAutofix?': clearable('boolean')
}) as Type<NotificationUserHealthCheckAutofixParams>;

/**
 * The result of a `healthCheckAutofix` invocation.
 */
export interface NotificationUserHealthCheckAutofixResult {
  /**
   * The outcome of each requested fix, in the order the codes were requested.
   */
  readonly results: NotificationHealthCheckIssueAutofixResult[];
  /**
   * The health check after the fixes were applied, with the fixed delivery method checked again.
   *
   * Also persisted to the {@link NotificationUser}'s `hc` field.
   */
  readonly healthCheck: NotificationHealthCheck;
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
 *
 * @dbxModelApiParams
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
 *
 * @dbxModelApiParams
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
 *
 * @dbxModelApiParams
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
  | 'throttled'
  | 'isNotificationTask'
  | 'isLoggedEvent'
  | 'isUniqueNotificationTask'
  | 'notificationTaskCompletionType'
  | 'uniqueNotificationTaskConflict'
  | 'isConfiguredTemplateType'
  | 'isKnownTemplateType'
  | 'notificationTemplateType'
  | 'notificationMarkedDone'
  | 'deletedNotification'
  | 'createdBox'
  | 'success'
  | 'exists'
  | 'boxExists'
  | 'notificationBoxNeedsInitialization'
  | 'tryRun'
  | 'loadMessageFunctionFailure'
  | 'buildMessageFailure'
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

// MARK: NotificationTaskBot
/**
 * arktype validator for a {@link NotificationTaskBotEntryId}.
 *
 * Built from {@link NOTIFICATION_TASK_BOT_ENTRY_ID_REGEX} and {@link NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH}, the same rules `isNotificationTaskBotEntryId()` checks.
 */
export const notificationTaskBotEntryIdType = /* @__PURE__ */ type(NOTIFICATION_TASK_BOT_ENTRY_ID_REGEX).atMostLength(NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH);

/**
 * arktype validator for a {@link NotificationTaskBotScriptGroupKey}.
 *
 * Built from {@link NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_REGEX} and {@link NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_MAX_LENGTH}, the same rules `isNotificationTaskBotScriptGroupKey()` checks.
 */
export const notificationTaskBotScriptGroupKeyType = /* @__PURE__ */ type(NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_REGEX).atMostLength(NOTIFICATION_TASK_BOT_SCRIPT_GROUP_KEY_MAX_LENGTH);

/**
 * Maximum number of group keys in each list of {@link UpdateNotificationTaskBotOptOutParams}.
 */
export const UPDATE_NOTIFICATION_TASK_BOT_OPT_OUT_MAX_GROUPS = 50;

/**
 * Base params targeting a single entry on a {@link NotificationTaskBot}.
 */
export interface NotificationTaskBotEntryTargetParams extends TargetModelParams {
  /**
   * The entry id.
   */
  readonly i: NotificationTaskBotEntryId;
}

export const notificationTaskBotEntryTargetParamsType = targetModelParamsType.merge({
  i: notificationTaskBotEntryIdType
}) as Type<NotificationTaskBotEntryTargetParams>;

/**
 * Used for updating the state and schedule of a single entry on a {@link NotificationTaskBot}.
 *
 * @dbxModelApiParams
 */
export interface UpdateNotificationTaskBotEntryParams extends NotificationTaskBotEntryTargetParams {
  /**
   * Enables or disables the entry. Disabling cancels the live run.
   */
  readonly s?: Maybe<NotificationTaskBotEntryState>;
  /**
   * True pauses the entry (reason `'manual'`) and cancels the live run. False resumes it (also when it was paused until
   * a time) and schedules a run. False wins over {@link pauseUntil}.
   */
  readonly pause?: Maybe<boolean>;
  /**
   * Pauses the entry (reason `'manual'`) until this time; it then resumes on its own. A time in the past resumes it on
   * the next queue pass. Null is ignored. `pause: false` in the same request wins and resumes the entry.
   */
  readonly pauseUntil?: Maybe<Date>;
  /**
   * Reschedules the entry. A date schedules a run that starts no sooner than that time, and the script's due check
   * still applies; null schedules a run due now, letting the script compute the real due time.
   */
  readonly nextRunAt?: Maybe<Date>;
  /**
   * Reschedules the entry with an explicit run that starts at exactly this time and skips the script's due check. Wins
   * over {@link nextRunAt}. Null is ignored.
   */
  readonly nextRunAtExplicit?: Maybe<Date>;
  /**
   * Sets the entry's last submitted at time. Null clears it.
   */
  readonly lsat?: Maybe<Date>;
  /**
   * Runs the entry's live run immediately after the update, if it has one.
   *
   * Skipped when this same request scheduled the live run in the future ({@link nextRunAt} or {@link nextRunAtExplicit}
   * after now, or {@link pauseUntil} given); the result then has no `runResult`. Any other live run that is scheduled in
   * the future still waits for its time. To re-evaluate an entry now, pass `nextRunAt: null` (optionally with
   * `lsat: null`).
   */
  readonly runImmediately?: Maybe<boolean>;
}

export const updateNotificationTaskBotEntryParamsType = notificationTaskBotEntryTargetParamsType.merge({
  's?': clearable(type.enumerated(NotificationTaskBotEntryState.ENABLED, NotificationTaskBotEntryState.DISABLED)),
  'pause?': clearable('boolean'),
  'pauseUntil?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'nextRunAt?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'nextRunAtExplicit?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'lsat?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'runImmediately?': clearable('boolean')
}) as Type<UpdateNotificationTaskBotEntryParams>;

/**
 * Result of updating a {@link NotificationTaskBot} entry.
 */
export interface UpdateNotificationTaskBotEntryResult {
  /**
   * Status of the entry after the update.
   *
   * A resume, enable or reschedule that could not take effect because the owner opted out of the entry's group reports
   * `opted_out`. Admins can't undo an owner's opt-out.
   */
  readonly status: NotificationTaskBotEntryStatus;
  /**
   * Key of the entry's live run task, if it has one.
   */
  readonly taskKey?: Maybe<NotificationTaskKey>;
  /**
   * Result of running the live run immediately, if requested.
   */
  readonly runResult?: Maybe<SendNotificationResult>;
}

/**
 * Used for running a single entry on a {@link NotificationTaskBot} on demand.
 *
 * The live run is superseded by a new run due now. Disabled, paused and opted-out entries are refused; an entry is opted
 * out when the bot's owner turned off its script group, which only the owner can undo.
 *
 * @dbxModelApiParams
 */
export interface RunNotificationTaskBotEntryParams extends NotificationTaskBotEntryTargetParams {
  /**
   * MANUAL runs still apply the script's due check; FORCED runs skip it. Defaults to MANUAL.
   */
  readonly trigger?: Maybe<NotificationTaskBotRunTrigger.MANUAL | NotificationTaskBotRunTrigger.FORCED>;
  /**
   * Whether to run the new run immediately. Defaults to true.
   */
  readonly runImmediately?: Maybe<boolean>;
}

export const runNotificationTaskBotEntryParamsType = notificationTaskBotEntryTargetParamsType.merge({
  'trigger?': clearable(type.enumerated(NotificationTaskBotRunTrigger.MANUAL, NotificationTaskBotRunTrigger.FORCED)),
  'runImmediately?': clearable('boolean')
}) as Type<RunNotificationTaskBotEntryParams>;

/**
 * Result of running a {@link NotificationTaskBot} entry.
 */
export interface RunNotificationTaskBotEntryResult {
  /**
   * Key of the new run task this call created.
   *
   * When the due check found a MANUAL run not due yet, that run handed over to a SCHEDULED run at the due time; the
   * entry's live run (`nk`) is then that hand-over, not this task.
   */
  readonly taskKey: NotificationTaskKey;
  /**
   * Result of running the new run, if it was run immediately.
   */
  readonly runResult?: Maybe<SendNotificationResult>;
}

/**
 * Used for reading the owner opt-outs of a {@link NotificationTaskBot}.
 *
 * The `key` is the bot's key (see `notificationTaskBotKeyForModel()`). Lists only the script groups the bot's owner can
 * opt out of; the bot's entries and script types are never returned.
 *
 * Callable by the bot's owner and by admins (read-only for admins).
 *
 * @dbxModelApiParams
 */
export interface ReadNotificationTaskBotOptOutsParams extends TargetModelParams {}

export const readNotificationTaskBotOptOutsParamsType = targetModelParamsType as Type<ReadNotificationTaskBotOptOutsParams>;

/**
 * Used for opting the bot's owner out of (or back into) script groups on a {@link NotificationTaskBot}.
 *
 * The `key` is the bot's key. Only groups listed by `read:optOuts` can change, and only the bot's owner can change
 * them, in both directions. Admins can't: an admin has no way to undo an owner's opt-out. A group may not appear in
 * both lists.
 *
 * Opting out stops every opt-out-able entry in the group and deletes its pending run. Opting back in schedules a run
 * due now for each idle, enabled and unpaused entry, the same as an admin resume.
 *
 * @dbxModelApiParams
 */
export interface UpdateNotificationTaskBotOptOutParams extends TargetModelParams {
  /**
   * Groups to opt out of.
   */
  readonly optOut?: Maybe<NotificationTaskBotScriptGroupKey[]>;
  /**
   * Groups to opt back into.
   */
  readonly optIn?: Maybe<NotificationTaskBotScriptGroupKey[]>;
}

export const updateNotificationTaskBotOptOutParamsType = targetModelParamsType.merge({
  'optOut?': clearable(notificationTaskBotScriptGroupKeyType.array().atMostLength(UPDATE_NOTIFICATION_TASK_BOT_OPT_OUT_MAX_GROUPS)),
  'optIn?': clearable(notificationTaskBotScriptGroupKeyType.array().atMostLength(UPDATE_NOTIFICATION_TASK_BOT_OPT_OUT_MAX_GROUPS))
}) as Type<UpdateNotificationTaskBotOptOutParams>;

/**
 * Result of reading or updating the owner opt-outs of a {@link NotificationTaskBot}.
 */
export interface NotificationTaskBotOptOutsResult {
  /**
   * The groups the owner can opt out of, with their opt-out state. A set `optOutAt` means the group is opted out.
   */
  readonly groups: NotificationTaskBotOwnerOptOutGroup[];
}

/**
 * Aggregate result of the `repairAllNotificationTaskBots` action.
 */
export interface RepairAllNotificationTaskBotsResult {
  /**
   * Number of overdue bots that were checked.
   */
  readonly botsChecked: number;
  /**
   * Number of overdue entries whose run was still pending, and only had their `nat` synced.
   */
  readonly entriesSynced: number;
  /**
   * Number of overdue entries whose run was lost and was rescheduled or paused.
   */
  readonly entriesRepaired: number;
}

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for notifications. Currently empty — all operations use the CRUD pattern.
 */
export type NotificationFunctionTypeMap = {};

export const NOTIFICATION_FUNCTION_TYPE_CONFIG_MAP: FirebaseFunctionTypeConfigMap<NotificationFunctionTypeMap> = {};

export type NotificationBoxModelCrudFunctionsConfig = {
  readonly notificationUser: {
    /**
     * Creates the NotificationUser for a user, so they can manage their notification settings before
     * being added to any NotificationBox.
     *
     * Idempotent: returns the existing document unchanged when it already exists.
     */
    create: CreateNotificationUserParams;
    update: {
      _: UpdateNotificationUserParams;
      resync: [ResyncNotificationUserParams, ResyncNotificationUserResult];
    };
    invoke: {
      healthCheck: [NotificationUserHealthCheckParams, NotificationUserHealthCheckResult];
      healthCheckAutofix: [NotificationUserHealthCheckAutofixParams, NotificationUserHealthCheckAutofixResult];
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
  readonly notificationTaskBot: {
    read: {
      /**
       * Lists the script groups the bot's owner can opt out of, with their opt-out state. Never returns entries.
       *
       * Callable by the bot's owner and by admins.
       */
      optOuts: [ReadNotificationTaskBotOptOutsParams, NotificationTaskBotOptOutsResult];
    };
    update: {
      /**
       * Admin-only. Enables/disables, pauses/resumes or reschedules a single entry. Reports `opted_out` when the owner
       * opted out of the entry's group, which only the owner can undo.
       */
      entry: [UpdateNotificationTaskBotEntryParams, UpdateNotificationTaskBotEntryResult];
      /**
       * Admin-only. Runs a single entry on demand. Refused for disabled, paused and opted-out entries.
       */
      run: [RunNotificationTaskBotEntryParams, RunNotificationTaskBotEntryResult];
      /**
       * Owner-only. Opts the bot's owner out of (or back into) script groups listed by `read:optOuts`. Admins can't
       * change an owner's opt-outs in either direction.
       */
      optOut: [UpdateNotificationTaskBotOptOutParams, NotificationTaskBotOptOutsResult];
    };
  };
};

export const NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['create', 'update:_,resync', 'invoke:healthCheck,healthCheckAutofix'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient'],
  notification: ['update:send'],
  notificationTaskBot: ['read:optOuts', 'update:entry,run,optOut']
};

/**
 * Abstract client-callable function map for notification CRUD operations.
 *
 * Implementations are generated by {@link notificationFunctionMap} for client-side use,
 * and by the server-side function registration in the demo-api or application module.
 */
export abstract class NotificationFunctions implements ModelFirebaseFunctionMap<NotificationFunctionTypeMap, NotificationBoxModelCrudFunctionsConfig> {
  abstract notificationUser: {
    createNotificationUser: ModelFirebaseCreateFunction<CreateNotificationUserParams>;
    updateNotificationUser: {
      update: ModelFirebaseCrudFunction<UpdateNotificationUserParams>;
      resync: ModelFirebaseCrudFunction<ResyncNotificationUserParams, ResyncNotificationUserResult>;
    };
    invokeNotificationUser: {
      healthCheck: ModelFirebaseCrudFunction<NotificationUserHealthCheckParams, NotificationUserHealthCheckResult>;
      healthCheckAutofix: ModelFirebaseCrudFunction<NotificationUserHealthCheckAutofixParams, NotificationUserHealthCheckAutofixResult>;
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
  abstract notificationTaskBot: {
    readNotificationTaskBot: {
      optOuts: ModelFirebaseReadFunction<ReadNotificationTaskBotOptOutsParams, NotificationTaskBotOptOutsResult>;
    };
    updateNotificationTaskBot: {
      entry: ModelFirebaseCrudFunction<UpdateNotificationTaskBotEntryParams, UpdateNotificationTaskBotEntryResult>;
      run: ModelFirebaseCrudFunction<RunNotificationTaskBotEntryParams, RunNotificationTaskBotEntryResult>;
      optOut: ModelFirebaseCrudFunction<UpdateNotificationTaskBotOptOutParams, NotificationTaskBotOptOutsResult>;
    };
  };
}

/**
 * Factory for creating client-side callable function instances from the notification CRUD configuration.
 */
export const notificationFunctionMap = callModelFirebaseFunctionMapFactory(NOTIFICATION_FUNCTION_TYPE_CONFIG_MAP, NOTIFICATION_BOX_MODEL_CRUD_FUNCTIONS_CONFIG);
