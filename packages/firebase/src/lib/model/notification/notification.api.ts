import { Type, Expose } from 'class-transformer';
import { callModelFirebaseFunctionMapFactory, TargetModelParams, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, IsFirestoreModelId, FirestoreModelKey, IsFirestoreModelKey, type FirebaseAuthUserId } from '@dereekb/firebase';
import { MinLength, IsNumber, IsEmail, IsPhoneNumber, IsBoolean, IsOptional, IsArray, ValidateNested, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { type E164PhoneNumber, type EmailAddress, type IndexNumber, Maybe } from '@dereekb/util';
import { type NotificationItem, type NotificationItemMetadata, type NotificationTypes } from './notification';
import { type NotificationBoxRecipientTemplateConfigArrayEntry } from './notification.config';
import { NotificationTemplateType } from './notification.id';

export const NOTIFICATION_RECIPIENT_NAME_MIN_LENGTH = 0;
export const NOTIFICATION_RECIPIENT_NAME_MAX_LENGTH = 42;

export const NOTIFICATION_SUBJECT_MIN_LENGTH = 2;
export const NOTIFICATION_SUBJECT_MAX_LENGTH = 100;

export const NOTIFICATION_MESSAGE_MIN_LENGTH = 2;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 1000;

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
 * Used for initializing an uninitialized NotificationBox
 */
export class InitializeNotificationBoxParams extends TargetModelParams {
  /**
   * Whether or not to throw an error if the notification has already been sent or is being sent.
   */
  @Expose()
  @IsOptional()
  @IsBoolean()
  throwErrorIfInitialized?: Maybe<boolean>;
}

export class InitializeAllApplicableNotificationBoxesParams {}

export interface InitializeAllApplicableNotificationBoxesResult {
  notificationBoxesVisited: number;
  notificationBoxesSucceeded: number;
  notificationBoxesFailed: number;
  notificationBoxesAlreadyInitialized: number;
}

/**
 * Used for updating the NotificationBox.
 */
export class UpdateNotificationBoxParams extends TargetModelParams {}

export class NotificationBoxRecipientTemplateConfigArrayEntryParam implements NotificationBoxRecipientTemplateConfigArrayEntry {
  @Expose()
  @IsString()
  type!: string;

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
  sn?: Maybe<boolean>;
}

/**
 * Used to create/update a notification box recipient.
 */
export class UpdateNotificationBoxRecipientParams extends TargetModelParams {
  /**
   * Notification recipient to update by UID, if applicable.
   */
  @Expose()
  @IsOptional()
  @IsFirestoreModelId()
  uid?: Maybe<FirebaseAuthUserId>;

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
  @IsPhoneNumber()
  p?: Maybe<E164PhoneNumber>;

  /**
   * Array of configs
   */
  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationBoxRecipientTemplateConfigArrayEntryParam)
  configs: Maybe<NotificationBoxRecipientTemplateConfigArrayEntryParam[]>;

  /**
   * Whether or not to insert the user if they currently do not exist. Defaults to false.
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
 * Used for enqueuing a new notification for a NotificationBox.
 */
export class CreateNotificationParams<D extends NotificationItemMetadata = {}> extends TargetModelParams implements Omit<NotificationItem, 'id' | 'cat'> {
  /**
   * User creating the notification. Is set automatically by the server.
   */
  @Expose()
  @IsOptional()
  @IsString()
  cb?: Maybe<FirebaseAuthUserId>;

  @Expose()
  @IsString()
  t!: NotificationTemplateType;

  @Expose()
  @IsOptional()
  @IsFirestoreModelKey()
  m?: Maybe<FirestoreModelKey>;

  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(NOTIFICATION_SUBJECT_MIN_LENGTH)
  @MaxLength(NOTIFICATION_SUBJECT_MAX_LENGTH)
  s?: Maybe<string>;

  @Expose()
  @IsOptional()
  @IsString()
  @MinLength(NOTIFICATION_MESSAGE_MIN_LENGTH)
  @MaxLength(NOTIFICATION_MESSAGE_MAX_LENGTH)
  g?: Maybe<string>;

  @Expose()
  @IsOptional()
  d?: Maybe<D>;

  @Expose()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientParams)
  r?: Maybe<NotificationRecipientParams[]>;
}

/**
 * Used for updating the notification. Only applicable before the notification is sent.
 */
export class UpdateNotificationParams extends TargetModelParams {}

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

export interface SendNotificationResult {
  /**
   * Attempted notification type
   */
  notificationTemplateType: Maybe<NotificationTemplateType>;
  /**
   * Whether or not the notification was of a known type.
   */
  isKnownTemplateType: Maybe<boolean>;
  /**
   * Whether or not the try was aborted due to being throttled.
   */
  throttled: boolean;
  /**
   * Whether or not the run was successful.
   *
   * In cases where the Notification is set to SEND_IF_BOX_EXISTS and the box does not exist, this will return true.
   */
  success: boolean;
  /**
   * Whether or not the notification was marked as done.
   *
   * May occur in cases where success is false, but the notification reached the max number of send attempts.
   */
  notificationMarkedDone: boolean;
  /**
   * Whether or not the NotificationBox was created.
   */
  createdBox: boolean;
  /**
   * Whether or not the notification was deleted.
   *
   * This typically only occurs when SEND_IF_BOX_EXISTS is set and the box does not exist.
   */
  deletedNotification: boolean;
  exists: boolean;
  boxExists: boolean;
  tryRun: boolean;
  /**
   * Number of text messages sent. Not attempted if null/undefined.
   */
  textsSent: Maybe<number>;
  /**
   * Number of email messages sent. Not attempted if null/undefined.
   */
  emailsSent: Maybe<number>;
  /**
   * Number of push notifications sent. Not attempted if null/undefined.
   */
  pushNotificationsSent: Maybe<number>;
  /**
   * Failed while attempting to loada the proper message function
   */
  loadMessageFunctionFailure: boolean;
  /**
   * Failed while attempting to build a message
   */
  buildMessageFailure: boolean;
}

/**
 * Used for sending queued notifications in the system.
 */
export class SendQueuedNotificationsParams {}

export interface SendQueuedNotificationsResult extends Omit<SendNotificationResult, 'throttled' | 'isKnownTemplateType' | 'notificationTemplateType' | 'notificationMarkedDone' | 'deletedNotification' | 'createdBox' | 'success' | 'exists' | 'boxExists' | 'tryRun' | 'loadMessageFunctionFailure' | 'buildMessageFailure'> {
  readonly notificationBoxesCreated: number;
  readonly notificationsVisited: number;
  readonly notificationsSucceeded: number;
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
  readonly notificationsDeleted: number;
  readonly notificationWeeksCreated: number;
  readonly notificationWeeksUpdated: number;
}

// MARK: Functions
export type NotificationFunctionTypeMap = {};

export const notificationFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<NotificationFunctionTypeMap> = {};

export type NotificationBoxModelCrudFunctionsConfig = {
  readonly notificationUser: null; // TODO: add API calls to update their settings, etc.
  readonly notificationBox: null;
  readonly notification: null;
  readonly notificationWeek: null;
};

export const notificationBoxModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<NotificationBoxModelCrudFunctionsConfig, NotificationTypes> = {};

export abstract class NotificationFunctions implements ModelFirebaseFunctionMap<NotificationFunctionTypeMap, NotificationBoxModelCrudFunctionsConfig> {}

export const notificationFunctionMap = callModelFirebaseFunctionMapFactory(notificationFunctionTypeConfigMap, notificationBoxModelCrudFunctionsConfig);
