import { Type, Expose } from 'class-transformer';
import { TargetModelParams, IsFirestoreModelId, type FirestoreModelKey, IsFirestoreModelKey, type FirebaseAuthUserId } from '../../common';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { MinLength, IsNumber, IsEmail, IsPhoneNumber, IsBoolean, IsOptional, IsArray, ValidateNested, IsNotEmpty, IsString, MaxLength, IsEnum, IsDate } from 'class-validator';
import { type E164PhoneNumber, type EmailAddress, type IndexNumber, type Maybe } from '@dereekb/util';
import { type NotificationTypes } from './notification';
import { type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationBoxRecipientTemplateConfigArrayEntry, NotificationBoxRecipientFlag } from './notification.config';
import { type NotificationBoxId, type NotificationSummaryId, type NotificationTemplateType } from './notification.id';
import { IsE164PhoneNumber } from '@dereekb/model';
import { type NotificationSendEmailMessagesResult, type NotificationSendTextMessagesResult, type NotificationSendNotificationSummaryMessagesResult } from './notification.send';
import { NotificationTaskServiceTaskHandlerCompletionType } from './notification.task';

export const NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH = 0;
export const NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH = 42;

export const NOTIFICATION_SUBJECT_MIN_LENGTH = 2;
export const NOTIFICATION_SUBJECT_MAX_LENGTH = 100;

export const NOTIFICATION_MESSAGE_MIN_LENGTH = 2;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

/**
 * Config entries are inserted, unless marked as remove.
 */
export class NotificationBoxRecipientTemplateConfigArrayEntryParam implements NotificationBoxRecipientTemplateConfigArrayEntry {
  @Expose()
  @IsString()
  type!: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  sd?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  se?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  st?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  sp?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  sn?: Maybe<boolean>;

  /**
   * If true, removes this configuration
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  remove?: Maybe<boolean>;
}

/**
 * Used for creating a new NotificationUser for a user.
 */
export class CreateNotificationUserParams {
  /**
   * UID of the user to create the NotificationUser for.
   */
  @Expose()
  @IsOptional()
  @IsFirestoreModelId()
  uid!: FirebaseAuthUserId;
}

/**
 * Used for updating the global or default config on a NotificationUser.
 */
export class UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams implements Omit<NotificationUserDefaultNotificationBoxRecipientConfig, 'c'> {
  /**
   * NotificationBox recipient to update. Is ignored if UID is provided and matches a user. Used for external recipients/users.
   */
  @Expose()
  @IsOptional()
  @IsNumber()
  i?: Maybe<IndexNumber>;

  /**
   * Override email address
   */
  @Expose()
  @IsOptional()
  @IsEmail()
  e?: Maybe<EmailAddress>;

  /**
   * Override phone number
   */
  @Expose()
  @IsOptional()
  @IsE164PhoneNumber()
  t?: Maybe<E164PhoneNumber>;

  /**
   * Array of configs that correspond with "c"
   */
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationBoxRecipientTemplateConfigArrayEntryParam)
  configs?: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;

  @Expose()
  @IsBoolean()
  @IsOptional()
  lk?: Maybe<boolean>;

  @Expose()
  @IsBoolean()
  @IsOptional()
  bk?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsEnum(NotificationBoxRecipientFlag)
  f?: Maybe<NotificationBoxRecipientFlag>;
}

export class UpdateNotificationBoxRecipientLikeParams {
  /**
   * Override email address
   */
  @Expose()
  @IsOptional()
  @IsEmail()
  e?: Maybe<EmailAddress>;

  /**
   * Override phone number
   */
  @Expose()
  @IsOptional()
  @IsE164PhoneNumber()
  t?: Maybe<E164PhoneNumber>;

  /**
   * Notification summary id
   */
  @Expose()
  @IsOptional()
  @IsPhoneNumber()
  s?: Maybe<NotificationSummaryId>;

  /**
   * Array of configs
   */
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationBoxRecipientTemplateConfigArrayEntryParam)
  configs?: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;
}

/**
 * Used for updating the target NotificationUserNotificationBoxRecipientConfig.
 */
export class UpdateNotificationUserNotificationBoxRecipientParams extends UpdateNotificationBoxRecipientLikeParams {
  /**
   * NotificationBox config to update
   */
  @Expose()
  @IsFirestoreModelId()
  nb!: NotificationBoxId;

  @Expose()
  @IsOptional()
  @IsBoolean()
  rm?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  lk?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsBoolean()
  bk?: Maybe<boolean>;

  @Expose()
  @IsOptional()
  @IsEnum(() => NotificationBoxRecipientFlag)
  f?: Maybe<NotificationBoxRecipientFlag>;

  /**
   * Whether or not to delete this configuration entirely.
   *
   * Will only delete if rm is true and ns is false. Is ignored otherwise.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  deleteRemovedConfig?: Maybe<boolean>;
}

/**
 * Used for updating the NotificationUser.
 */
export class UpdateNotificationUserParams extends TargetModelParams {
  // TODO: update configs...

  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams)
  gc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;

  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams)
  dc?: Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationUserNotificationBoxRecipientParams)
  bc?: Maybe<UpdateNotificationUserNotificationBoxRecipientParams[]>;
}

export class ResyncNotificationUserParams extends TargetModelParams {}

export interface ResyncNotificationUserResult {
  /**
   * Total number of notification boxes updated.
   */
  readonly notificationBoxesUpdated: number;
}

export class ResyncAllNotificationUserParams {}

export interface ResyncAllNotificationUsersResult extends ResyncNotificationUserResult {
  /**
   * Total number of users updated.
   */
  readonly notificationUsersResynced: number;
}

/**
 * Used for creating a new NotificationSummary for a model.
 */
export class CreateNotificationSummaryParams {
  /**
   * Model to create the NotificationSummary for.
   */
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  model!: FirestoreModelKey;
}

/**
 * Used for updating the NotificationSummary.
 */
export class UpdateNotificationSummaryParams extends TargetModelParams {
  /**
   * Updates the "rat" time to now.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  readonly flagAllRead?: Maybe<boolean>;

  /**
   * Sets the "rat" time to the given date, or clears it.
   */
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly setReadAtTime?: Maybe<Date>;
}

/**
 * Used for creating or initializing a new NotificationBox for a model.
 *
 * Mainly used for testing. Not exposed to the API.
 *
 * The preferred way is to create a NotificationBox through a Notification.
 */
export class CreateNotificationBoxParams {
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  model!: FirestoreModelKey;
}

/**
 * Used for initializing an uninitialized model like NotificationBox or NotificationSummary.
 */
export class InitializeNotificationModelParams extends TargetModelParams {
  /**
   * Whether or not to throw an error if the notification has already been sent or is being sent.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  throwErrorIfAlreadyInitialized?: boolean;
}

export class InitializeAllApplicableNotificationBoxesParams {}

export interface InitializeAllApplicableNotificationBoxesResult {
  readonly notificationBoxesVisited: number;
  readonly notificationBoxesSucceeded: number;
  readonly notificationBoxesFailed: number;
  readonly notificationBoxesAlreadyInitialized: number;
}

export class InitializeAllApplicableNotificationSummariesParams {}

export interface InitializeAllApplicableNotificationSummariesResult {
  readonly notificationSummariesVisited: number;
  readonly notificationSummariesSucceeded: number;
  readonly notificationSummariesFailed: number;
  readonly notificationSummariesAlreadyInitialized: number;
}

/**
 * Used for updating the NotificationBox.
 */
export class UpdateNotificationBoxParams extends TargetModelParams {}

/**
 * Used to create/update a notification box recipient.
 */
export class UpdateNotificationBoxRecipientParams extends UpdateNotificationBoxRecipientLikeParams implements TargetModelParams {
  /**
   * NotificationBox key to update.
   */
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  key!: FirestoreModelKey;

  /**
   * NotificationBox recipient to update. Is ignored if UID is provided and matches a user. Used for external recipients/users.
   */
  @Expose()
  @IsOptional()
  @IsNumber()
  i?: Maybe<IndexNumber>;

  /**
   * Notification recipient to update by UID, if applicable.
   */
  @Expose()
  @IsOptional()
  @IsFirestoreModelId()
  uid?: Maybe<FirebaseAuthUserId>;

  /**
   * Whether or not to create the user if they currently do not exist. Defaults to false.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  insert?: Maybe<boolean>;

  /**
   * Whether or not to enable/disable the recipient from recieving items from this box.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  enabled?: Maybe<boolean>;

  /**
   * Whether or not to remove the user if they exist. Defaults to false.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  remove?: Maybe<boolean>;
}

export class NotificationRecipientParams {
  /**
   * User to send the notification to.
   */
  @Expose()
  @IsOptional()
  @IsFirestoreModelId()
  uid?: Maybe<FirebaseAuthUserId>;

  /**
   * Recipient Name
   */
  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH)
  @MaxLength(NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH)
  un?: Maybe<string>;

  /**
   * Email address
   */
  @Expose()
  @IsOptional()
  @IsEmail()
  e?: Maybe<EmailAddress>;

  /**
   * Phone number
   */
  @Expose()
  @IsOptional()
  @IsPhoneNumber()
  p?: Maybe<E164PhoneNumber>;
}

/**
 * Used for sending the notification immediately, if it has not already been sent.
 */
export class SendNotificationParams extends TargetModelParams {
  /**
   * Whether or not to ignore the send at time. Defaults to false.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  ignoreSendAtThrottle?: Maybe<boolean>;
  /**
   * Whether or not to throw an error if the notification has already been sent or is being sent.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  throwErrorIfSent?: Maybe<boolean>;
}

/**
 * Params class used for subscribing a system user to a NotificationBox for a model.
 */
export abstract class AbstractSubscribeToNotificationBoxParams extends TargetModelParams {
  /**
   * Notification recipient to subscribe to notifications
   */
  @Expose()
  @IsFirestoreModelId()
  uid!: FirebaseAuthUserId;
}

export abstract class AbstractSubscribeOrUnsubscribeToNotificationBoxParams extends AbstractSubscribeToNotificationBoxParams {
  /**
   * If true, unsubscribes from the notification box instead.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  unsubscribe?: Maybe<boolean>;
}

export interface SendNotificationResult {
  /**
   * Attempted notification type
   */
  readonly notificationTemplateType: Maybe<NotificationTemplateType>;
  /**
   * Whether or not the notification was of a known type.
   */
  readonly isKnownTemplateType: Maybe<boolean>;
  /**
   * Whether or not the notification was of a task type.
   */
  readonly isNotificationTask: boolean;
  /**
   * Whether or not the notification was of a configured type.
   */
  readonly isConfiguredTemplateType: Maybe<boolean>;
  /**
   * Whether or not the try was aborted due to being throttled.
   */
  readonly throttled: boolean;
  /**
   * Whether or not the run was successful.
   *
   * In cases where the Notification is set to SEND_IF_BOX_EXISTS and the box does not exist, this will return true.
   */
  readonly success: boolean;
  /**
   * Completion type for the notification task, if applicable.
   */
  readonly notificationTaskCompletionType?: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
  /**
   * Whether or not the notification was marked as done.
   *
   * May occur in cases where success is false, but the notification reached the max number of send attempts.
   */
  readonly notificationMarkedDone: boolean;
  /**
   * Whether or not the NotificationBox was created.
   */
  readonly createdBox: boolean;
  /**
   * Whether or not the NotificationBox exists but still needs initialization.
   */
  readonly notificationBoxNeedsInitialization: boolean;
  /**
   * Whether or not the notification was deleted.
   *
   * This typically only occurs when SEND_IF_BOX_EXISTS is set and the box does not exist.
   */
  readonly deletedNotification: boolean;
  readonly exists: boolean;
  readonly boxExists: boolean;
  readonly tryRun: boolean;
  /**
   * Send emails result.
   *
   * Undefined if not attempted or a task notification.
   */
  readonly sendEmailsResult: Maybe<NotificationSendEmailMessagesResult>;
  /**
   *
   * Send texts result.
   *
   * Undefined if not attempted or a task notification.
   */
  readonly sendTextsResult: Maybe<NotificationSendTextMessagesResult>;
  /**
   * Send notification summaries result.
   *
   * Undefined if not attempted or a task notification.
   */
  readonly sendNotificationSummaryResult: Maybe<NotificationSendNotificationSummaryMessagesResult>;
  /**
   * Failed while attempting to loada the proper message function
   */
  readonly loadMessageFunctionFailure: boolean;
  /**
   * Failed while attempting to build a message
   */
  readonly buildMessageFailure: boolean;
}

/**
 * Used for sending queued notifications in the system.
 */
export class SendQueuedNotificationsParams {}

export interface SendQueuedNotificationsResult extends Omit<SendNotificationResult, 'throttled' | 'isNotificationTask' | 'isConfiguredTemplateType' | 'isKnownTemplateType' | 'notificationTemplateType' | 'notificationMarkedDone' | 'deletedNotification' | 'createdBox' | 'success' | 'exists' | 'boxExists' | 'notificationBoxNeedsInitialization' | 'tryRun' | 'loadMessageFunctionFailure' | 'buildMessageFailure'> {
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
export class CleanupSentNotificationsParams {}

export interface CleanupSentNotificationsResult {
  /**
   * Number of total updates. May include the same notification box more than once.
   */
  readonly notificationBoxesUpdatesCount: number;
  readonly notificationTasksDeletedCount: number;
  readonly notificationsDeleted: number;
  readonly notificationWeeksCreated: number;
  readonly notificationWeeksUpdated: number;
}

// MARK: Functions
export type NotificationFunctionTypeMap = {};

export const notificationFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<NotificationFunctionTypeMap> = {};

export type NotificationBoxModelCrudFunctionsConfig = {
  readonly notificationUser: {
    update: {
      _: UpdateNotificationUserParams;
      resync: [ResyncNotificationUserParams, ResyncNotificationUserResult];
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
  readonly notification: null;
  readonly notificationWeek: null;
};

export const notificationBoxModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {
  notificationUser: ['update:_,resync'],
  notificationSummary: ['update:_'],
  notificationBox: ['update:_,recipient']
};

export abstract class NotificationFunctions implements ModelFirebaseFunctionMap<NotificationFunctionTypeMap, NotificationBoxModelCrudFunctionsConfig> {
  abstract notificationUser: {
    updateNotificationUser: {
      update: ModelFirebaseCrudFunction<UpdateNotificationUserParams>;
      resync: ModelFirebaseCrudFunction<ResyncNotificationUserParams, ResyncNotificationUserResult>;
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
}

export const notificationFunctionMap = callModelFirebaseFunctionMapFactory(notificationFunctionTypeConfigMap, notificationBoxModelCrudFunctionsConfig);
