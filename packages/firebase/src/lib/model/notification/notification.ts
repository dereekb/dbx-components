import { type E164PhoneNumber, type EmailAddress, type Maybe, type NeedsSyncBoolean } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { inferNotificationBoxRelatedModelKey, NotificationBoxSendExclusionList, type NotificationBoxId } from './notification.id';
import { type NotificationBoxRecipient, firestoreNotificationBoxRecipient, firestoreNotificationRecipientWithConfig, type NotificationRecipientWithConfig, type NotificationUserNotificationBoxRecipientConfig, firestoreNotificationUserNotificationBoxRecipientConfig, type NotificationUserDefaultNotificationBoxRecipientConfig, firestoreNotificationUserDefaultNotificationBoxRecipientConfig } from './notification.config';
import { UNKNOWN_YEAR_WEEK_CODE, type YearWeekCode, yearWeekCode } from '@dereekb/date';
import { type UserRelatedById, type UserRelated } from '../user';
import {
  AbstractFirestoreDocument,
  AbstractFirestoreDocumentWithParent,
  type CollectionGroup,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreCollectionGroup,
  type FirestoreCollectionWithParent,
  type FirestoreContext,
  type FirestoreModelKey,
  type SavedToFirestoreIfTrue,
  firestoreBoolean,
  firestoreDate,
  firestoreEnum,
  firestoreModelIdArrayField,
  firestoreModelIdentity,
  firestoreModelKeyString,
  firestoreNumber,
  firestoreObjectArray,
  firestoreUID,
  optionalFirestoreBoolean,
  optionalFirestoreEnum,
  snapshotConverterFunctions,
  optionalFirestoreDate,
  firestoreUniqueStringArray,
  type SavedToFirestoreIfFalse,
  optionalFirestoreNumber
} from '../../common';
import { type NotificationItem, firestoreNotificationItem } from './notification.item';

export abstract class NotificationFirestoreCollections {
  abstract readonly notificationUserCollection: NotificationUserFirestoreCollection;
  abstract readonly notificationSummaryCollection: NotificationSummaryFirestoreCollection;
  abstract readonly notificationBoxCollection: NotificationBoxFirestoreCollection;
  abstract readonly notificationCollectionFactory: NotificationFirestoreCollectionFactory;
  abstract readonly notificationCollectionGroup: NotificationFirestoreCollectionGroup;
  abstract readonly notificationWeekCollectionFactory: NotificationWeekFirestoreCollectionFactory;
  abstract readonly notificationWeekCollectionGroup: NotificationWeekFirestoreCollectionGroup;
}

export type NotificationTypes = typeof notificationUserIdentity | typeof notificationSummaryIdentity | typeof notificationBoxIdentity | typeof notificationIdentity | typeof notificationWeekIdentity;

/**
 * Notification-related model that is initialized asynchronously at a later time.
 */
export interface InitializedNotificationModel {
  /**
   * True if this model needs to be sync'd/initialized with the original model.
   *
   * Is set false if/when "fi" is set true.
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * True if this model has been flagged invalid.
   *
   * This is for cases where the model cannot be properly initiialized.
   *
   * NOTE: The server can also be configured to automatically delete these models instead of marking them as invalid.
   */
  fi?: Maybe<SavedToFirestoreIfTrue>;
}

// MARK: NotificationUser
export const notificationUserIdentity = firestoreModelIdentity('notificationUser', 'nu');

/**
 * A global notification User in the system.
 *
 * Keeps track of the NotificationBoxes the user is subscribed to, as well as other global subscriptions.
 *
 * The NotificationUser is created automatically by the NotificationBox as a user is created.
 */
export interface NotificationUser extends UserRelated, UserRelatedById {
  /**
   * List of notification boxes this user is associated with. Cannot be changed directly.
   */
  b: NotificationBoxId[];
  /**
   * Notification box id exclusion list. This value is treated used to generated send opt-outs.
   *
   * This list is used to exclude a user from recieving notifications from the NotificationBoxes in this list.
   *
   * Values in this list are usually populated from functions from the model controlling the NotificationBox.
   *
   * The user must be associated with atleast one NotificationBoxId that matches items in this list, otherwise non-matching items are removed.
   *
   * The exclusions are sync'd to the corresponding bc values, which are then sync'd to the NotificationBoxes.
   */
  x: NotificationBoxSendExclusionList;
  /**
   * Global config override.
   *
   * This config effectively overrides all other configs, both NotificationBox configs and direct/default configs when used.
   * It does not however get copied to dc/bc when updated.
   */
  gc: NotificationUserDefaultNotificationBoxRecipientConfig;
  /**
   * Direct/default config.
   *
   * This config is retrieved and used for cases where the recipient isn't associated with the NotificationBox but was added on an ad-hoc basis as an additional user as a uid.
   */
  dc: NotificationUserDefaultNotificationBoxRecipientConfig;
  /**
   * List of NotificationBox configurations.
   */
  bc: NotificationUserNotificationBoxRecipientConfig[];
  /**
   * Whether or not the user has one or more configs that need to be synced.
   */
  ns?: Maybe<NeedsSyncBoolean>;
}

export type NotificationUserRoles = 'sync' | GrantedUpdateRole | GrantedReadRole;

export class NotificationUserDocument extends AbstractFirestoreDocument<NotificationUser, NotificationUserDocument, typeof notificationUserIdentity> {
  get modelIdentity() {
    return notificationUserIdentity;
  }
}

export const notificationUserConverter = snapshotConverterFunctions<NotificationUser>({
  fields: {
    uid: firestoreUID(),
    b: firestoreModelIdArrayField,
    x: firestoreModelIdArrayField,
    dc: firestoreNotificationUserDefaultNotificationBoxRecipientConfig,
    gc: firestoreNotificationUserDefaultNotificationBoxRecipientConfig,
    bc: firestoreObjectArray({
      objectField: firestoreNotificationUserNotificationBoxRecipientConfig
    }),
    ns: optionalFirestoreBoolean()
  }
});

export function notificationUserCollectionReference(context: FirestoreContext): CollectionReference<NotificationUser> {
  return context.collection(notificationUserIdentity.collectionName);
}

export type NotificationUserFirestoreCollection = FirestoreCollection<NotificationUser, NotificationUserDocument>;

export function notificationUserFirestoreCollection(firestoreContext: FirestoreContext): NotificationUserFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: notificationUserIdentity,
    converter: notificationUserConverter,
    collection: notificationUserCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationUserDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: NotificationSummary
/**
 * An arbitrary summary object
 */
export const notificationSummaryIdentity = firestoreModelIdentity('notificationSummary', 'ns');

/**
 * The maximum number of notifications that can be stored in a NotificationSummary.
 */
export const NOTIFICATION_SUMMARY_ITEM_LIMIT = 1000;

/**
 * The expected max length of a subject on a NotificationSummary's embedded NotificationItem.
 */
export const NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_SUBJECT_MAX_LENGTH = 80;

/**
 * The expected max length of a message on a NotificationSummary's embedded NotificationItem.
 */
export const NOTIFICATION_SUMMARY_EMBEDDED_NOTIFICATION_ITEM_MESSAGE_MAX_LENGTH = 500;

/**
 * Used to hold arbitrary NotificationItems in the system for an object. The id for this is the two-way flat key of the object it represents.
 *
 * Notification Items can be delivered here.
 */
export interface NotificationSummary {
  /**
   * Notification Summary creation date
   */
  cat: Date;
  /**
   * Model key of the model this box is assigned to.
   */
  m: FirestoreModelKey;
  /**
   * Owner model key of the model this box is assigned to.
   *
   * Is created with a dummy value until it is initialized.
   */
  o: FirestoreModelKey;
  /**
   * Notification items.
   *
   * They are sorted in ascending order, with the newest items at the end.
   */
  n: NotificationItem[];
  /**
   * Date of the latest notification.
   */
  lat?: Maybe<Date>;
  /**
   * Date of the last read at time so notifications can be marked as read.
   */
  rat?: Maybe<Date>;
  /**
   * True if this NotificationSummary needs to be sync'd/initialized with the original model.
   */
  s?: Maybe<NeedsSyncBoolean>;
}

/**
 * NotificationSummary roles
 */
export type NotificationSummaryRoles = GrantedReadRole;

export class NotificationSummaryDocument extends AbstractFirestoreDocument<NotificationSummary, NotificationSummaryDocument, typeof notificationSummaryIdentity> {
  get modelIdentity() {
    return notificationSummaryIdentity;
  }
}

export const notificationSummaryConverter = snapshotConverterFunctions<NotificationSummary>({
  fields: {
    cat: firestoreDate(),
    m: firestoreModelKeyString,
    o: firestoreModelKeyString,
    n: firestoreObjectArray({
      objectField: firestoreNotificationItem
    }),
    lat: optionalFirestoreDate(),
    rat: optionalFirestoreDate(),
    s: optionalFirestoreBoolean({ dontStoreIf: false })
  }
});

export function notificationSummaryCollectionReference(context: FirestoreContext): CollectionReference<NotificationSummary> {
  return context.collection(notificationSummaryIdentity.collectionName);
}

export type NotificationSummaryFirestoreCollection = FirestoreCollection<NotificationSummary, NotificationSummaryDocument>;

export function notificationSummaryFirestoreCollection(firestoreContext: FirestoreContext): NotificationSummaryFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: notificationSummaryIdentity,
    converter: notificationSummaryConverter,
    collection: notificationSummaryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationSummaryDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: NotificationBox
export const notificationBoxIdentity = firestoreModelIdentity('notificationBox', 'nb');

/**
 * A Notification Box in the system for an object. The id for this is the two-way flat key of the object it represents.
 *
 * This object is the root collection for notifications for the corresponding object.
 *
 * Additional information about what notification templates are available to this type are available on a per-application basis, typically through the
 * NotificationTemplateTypeInfoRecord configured for the app.
 *
 * Update to each recipient is propogated from NotificationUser values.
 */
export interface NotificationBox {
  /**
   * Notification Box creation date
   */
  cat: Date;
  /**
   * Model key of the model this box is assigned to.
   */
  m: FirestoreModelKey;
  /**
   * Owner model key of the model this box is assigned to.
   *
   * Is created with a dummy value until it is initialized.
   */
  o: FirestoreModelKey;
  /**
   * Embedded recipients.
   */
  r: NotificationBoxRecipient[];
  /**
   * Latest week.
   */
  w: YearWeekCode;
  /**
   * True if this NotificationBox needs to be sync'd/initialized with the original model.
   *
   * Is set false if/when "fi" is set true.
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * True if this NotificationBox has been flagged invalid.
   *
   * This is for cases where the NotificationBox cannot be properly initiialized.
   *
   * NOTE: The server can also be configured to automatically delete matching boxes instead of marking them as invalid.
   */
  fi?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * NotificationBox roles
 *
 * subscribe: user can subscribe or unsubscribe to/from this notification box and manage themselves.
 * manageRecipients: user can manage all recipients
 */
export type NotificationBoxRoles = 'subscribe' | 'manageRecipients' | 'createNotification' | GrantedReadRole | GrantedUpdateRole;

export class NotificationBoxDocument extends AbstractFirestoreDocument<NotificationBox, NotificationBoxDocument, typeof notificationBoxIdentity> {
  get modelIdentity() {
    return notificationBoxIdentity;
  }

  get notificationBoxRelatedModelKey() {
    return inferNotificationBoxRelatedModelKey(this.id);
  }
}

export const notificationBoxConverter = snapshotConverterFunctions<NotificationBox>({
  fields: {
    cat: firestoreDate(),
    m: firestoreModelKeyString,
    o: firestoreModelKeyString,
    r: firestoreObjectArray({
      objectField: firestoreNotificationBoxRecipient
    }),
    w: firestoreNumber({ default: () => yearWeekCode(new Date()) }),
    s: optionalFirestoreBoolean({ dontStoreIf: false }),
    fi: optionalFirestoreBoolean({ dontStoreIf: false })
  }
});

export function notificationBoxCollectionReference(context: FirestoreContext): CollectionReference<NotificationBox> {
  return context.collection(notificationBoxIdentity.collectionName);
}

export type NotificationBoxFirestoreCollection = FirestoreCollection<NotificationBox, NotificationBoxDocument>;

export function notificationBoxFirestoreCollection(firestoreContext: FirestoreContext): NotificationBoxFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: notificationBoxIdentity,
    converter: notificationBoxConverter,
    collection: notificationBoxCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationBoxDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Notification Data
export const notificationIdentity = firestoreModelIdentity(notificationBoxIdentity, 'notification', 'nbn');

export enum NotificationSendType {
  /**
   * Sends only if the NotificationBox exists.
   *
   * Does not create a NotificationBox for the model.
   */
  SEND_IF_BOX_EXISTS = 0,
  /**
   * Creates a NotificationBox if it doesn't exist, and then sends the Notification.
   */
  INIT_BOX_AND_SEND = 1,
  /**
   * Sends the notification even if the NotificationBox does not exist.
   */
  SEND_WITHOUT_CREATING_BOX = 2,
  /**
   * A task notification.
   *
   * This is used with Task-type notifications.
   */
  TASK_NOTIFICATION = 3
}

export enum NotificationSendState {
  /**
   * Notification will not be sent.
   */
  NONE = -1,
  /**
   * Notification is queued up.
   */
  QUEUED = 0,
  /**
   * Notification has been sent/complete. Will still show as sent even if there were no messages/recipients to send for this medium.
   */
  SENT = 1,
  /**
   * Some of the notifications have been sent, but some failed.
   */
  SENT_PARTIAL = 2,
  /**
   * Notification has been skipped due to the box's settings.
   */
  SKIPPED = 3,
  /**
   * Notification is flagged as being skipped and should not be reattempetd
   */
  NO_TRY = 4,
  /**
   * Notification encountered an error while sending and could not be sent.
   */
  SEND_ERROR = 5,
  /**
   * Notification encountered an error while building and could not be sent.
   */
  BUILD_ERROR = 6,
  /**
   * Notification encountered an error due to the system not being configured properly.
   */
  CONFIG_ERROR = 7
}

/**
 * Notification recipient send flags.
 */
export enum NotificationRecipientSendFlag {
  /**
   * Will send to all recipients.
   */
  NORMAL = 0,
  /**
   * Will not send to any of the configured notification box recipients. Will only to the globally configured message recpients or the notification specified recipients.
   */
  SKIP_NOTIFICATION_BOX_RECIPIENTS = 1,
  /**
   * Will not send to any of the globally configured message recpients. Will only send to the notification specified recipients or the notification box recipients.
   */
  SKIP_GLOBAL_RECIPIENTS = 2,
  /**
   * Will only sent to recipients that are configured in this notification. Will not send to globally configured message recipients or notification box recipients.
   */
  ONLY_EXPLICIT_RECIPIENTS = 3,
  /**
   * Will only sent to globally configured message recipients.
   */
  ONLY_GLOBAL_RECIPIENTS = 4
}

export interface NotificationSendFlags {
  /**
   * Text send state
   */
  ts: NotificationSendState;
  /**
   * Email send state
   */
  es: NotificationSendState;
  /**
   * Push notification send state
   */
  ps: NotificationSendState;
  /**
   * Notification summary send state
   */
  ns: NotificationSendState;
  /**
   * Push notification recipient send flag. Determines who will recieve the notifications, and if it should be saved to the NotificationWeek once sent.
   */
  rf?: Maybe<NotificationRecipientSendFlag>;
}

/**
 * Arbitrary unique string that denotes checkpoint progress for a multi-step task.
 */
export type NotificationTaskCheckpointString = string;

/**
 * Contains information about which recipients were already sent their messages, etc.
 */
export interface NotificationSendCheckpoints {
  /**
   * Set of numbers the notification was sent to via text/sms.
   */
  tsr: E164PhoneNumber[];
  /**
   * Set of emails that the notification was set to via email.
   */
  esr: EmailAddress[];
  /**
   * Set of checkpoint strings that denote checkpoint progress for a task.
   *
   * Used for multi-step tasks.
   */
  tpr: NotificationTaskCheckpointString[];
}

export interface Notification extends NotificationSendFlags, NotificationSendCheckpoints {
  /**
   * Created at date/time
   */
  cat: Date;
  /**
   * Send type
   */
  st: NotificationSendType;
  /**
   * Notification item
   */
  n: NotificationItem;
  /**
   * Additional embedded recipients.
   *
   * Any values for the NotificationBoxRecipientTemplateConfig-related parameters will be used when considering explicit opt-in/op-out.
   * (I.E. setting "st" to true for a user with no other config for the notification template type will mark them as opt-in for texts, and
   * can only be overridden by the user's own config)
   */
  r: NotificationRecipientWithConfig[];
  /**
   * Explicit opt-in send only.
   *
   * If true, will only send to users that have explicitly opted in to recieving notifications via specific methods.
   *
   * This setting takes priority over the system's configured default for this notification's template type.
   */
  ois?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Explicit opt-in text/sms send only.
   *
   * If false, will send text/sms to all users regardless if they have not explicitly opted in to text/sms. Will still take their opt-out into account.
   *
   * This setting takes priority over the system's configured default for this notification's template type.
   */
  ots?: Maybe<SavedToFirestoreIfFalse>;
  /**
   * Minimum time at which this notification should be sent.
   *
   * The notification is only guranteed to be sent after this time.
   *
   * This value is also used for locking/retrying. When locked for sending it is updated to push sat back a few minutes and increase the send attempts.
   */
  sat: Date;
  /**
   * Total sending attempts count.
   *
   * Only incremented when sending encounters an issue/error.
   */
  a: number;
  /**
   * Current task sending and delays attempts count.
   *
   * Only incremented when sending returns a delay or a failure for the current task checkpoint.
   *
   * Reset when a non-failure is returned, and when a checkpoint is completed.
   */
  at?: Maybe<number>;
  /**
   * Notification has been delivered or should be archived.
   *
   * This is now safe to sync to the NotificationWeek (not applicable for task-type notifications) and then delete this.
   *
   * For Task-type notifications, this is always set to false, as when the task is completed it is deleted.
   */
  d: boolean;
  /**
   * Unique Notification Task flag
   *
   * Only used for tasks.
   *
   * If flagged true, this task will be re-read and compared with the created at time before a task step is saved/completed when running the task.
   * If the created at time is different, the task changes are abandoned, and a success is returned.
   */
  ut?: Maybe<SavedToFirestoreIfTrue>;
}

export type NotificationSendRole = 'send';
export type NotificationRoles = GrantedReadRole | GrantedUpdateRole | NotificationSendRole;

export class NotificationDocument extends AbstractFirestoreDocumentWithParent<NotificationBox, Notification, NotificationDocument, typeof notificationIdentity> {
  get modelIdentity() {
    return notificationIdentity;
  }
}

export const notificationConverter = snapshotConverterFunctions<Notification>({
  fields: {
    cat: firestoreDate({ saveDefaultAsNow: true }),
    st: firestoreEnum<NotificationSendType>({ default: NotificationSendType.SEND_IF_BOX_EXISTS }),
    rf: optionalFirestoreEnum<NotificationRecipientSendFlag>(),
    ts: firestoreEnum<NotificationSendState>({ default: NotificationSendState.NONE }),
    es: firestoreEnum<NotificationSendState>({ default: NotificationSendState.NONE }),
    ps: firestoreEnum<NotificationSendState>({ default: NotificationSendState.NONE }),
    ns: firestoreEnum<NotificationSendState>({ default: NotificationSendState.NONE }),
    n: firestoreNotificationItem,
    r: firestoreObjectArray({
      objectField: firestoreNotificationRecipientWithConfig
    }),
    ois: optionalFirestoreBoolean({ dontStoreIf: false }),
    ots: optionalFirestoreBoolean({ dontStoreIf: true }),
    sat: firestoreDate(),
    a: firestoreNumber({ default: 0 }),
    at: optionalFirestoreNumber({ dontStoreIf: 0 }),
    d: firestoreBoolean({ default: false }),
    tsr: firestoreUniqueStringArray(),
    esr: firestoreUniqueStringArray(),
    tpr: firestoreUniqueStringArray(),
    ut: optionalFirestoreBoolean({ dontStoreIf: false })
  }
});

export function notificationCollectionReferenceFactory(context: FirestoreContext): (notificationBox: NotificationBoxDocument) => CollectionReference<Notification> {
  return (notificationBox: NotificationBoxDocument) => {
    return context.subcollection(notificationBox.documentRef, notificationIdentity.collectionName);
  };
}

export type NotificationFirestoreCollection = FirestoreCollectionWithParent<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument>;
export type NotificationFirestoreCollectionFactory = (parent: NotificationBoxDocument) => NotificationFirestoreCollection;

export function notificationFirestoreCollectionFactory(firestoreContext: FirestoreContext): NotificationFirestoreCollectionFactory {
  const factory = notificationCollectionReferenceFactory(firestoreContext);

  return (parent: NotificationBoxDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: notificationIdentity,
      converter: notificationConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new NotificationDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

export function notificationCollectionReference(context: FirestoreContext): CollectionGroup<Notification> {
  return context.collectionGroup(notificationIdentity.collectionName);
}

export type NotificationFirestoreCollectionGroup = FirestoreCollectionGroup<Notification, NotificationDocument>;

export function notificationFirestoreCollectionGroup(firestoreContext: FirestoreContext): NotificationFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: notificationIdentity,
    converter: notificationConverter,
    queryLike: notificationCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: Notification Week Data
export const notificationWeekIdentity = firestoreModelIdentity(notificationBoxIdentity, 'notificationWeek', 'nbnw');

/**
 * The maximum number of notifications that can be stored in a NotificationWeek.
 */
export const NOTIFICATION_WEEK_NOTIFICATION_ITEM_LIMIT = 5000;

/**
 * Notification week. Contains all notifications in the box for the given week.
 */
export interface NotificationWeek {
  /**
   * YearWeekCode value. Same as the id.
   */
  w: YearWeekCode;
  /**
   * Notification items.
   */
  n: NotificationItem[];
}

export type NotificationWeekRoles = GrantedReadRole;

export class NotificationWeekDocument extends AbstractFirestoreDocumentWithParent<NotificationBox, NotificationWeek, NotificationWeekDocument, typeof notificationWeekIdentity> {
  get modelIdentity() {
    return notificationWeekIdentity;
  }
}

export const notificationWeekConverter = snapshotConverterFunctions<NotificationWeek>({
  fields: {
    w: firestoreNumber({ default: UNKNOWN_YEAR_WEEK_CODE }),
    n: firestoreObjectArray({
      objectField: firestoreNotificationItem
    })
  }
});

export function notificationWeekCollectionReferenceFactory(context: FirestoreContext): (notificationBox: NotificationBoxDocument) => CollectionReference<NotificationWeek> {
  return (notificationBox: NotificationBoxDocument) => {
    return context.subcollection(notificationBox.documentRef, notificationWeekIdentity.collectionName);
  };
}

export type NotificationWeekFirestoreCollection = FirestoreCollectionWithParent<NotificationWeek, NotificationBox, NotificationWeekDocument, NotificationBoxDocument>;
export type NotificationWeekFirestoreCollectionFactory = (parent: NotificationBoxDocument) => NotificationWeekFirestoreCollection;

export function notificationWeekFirestoreCollectionFactory(firestoreContext: FirestoreContext): NotificationWeekFirestoreCollectionFactory {
  const factory = notificationWeekCollectionReferenceFactory(firestoreContext);

  return (parent: NotificationBoxDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: notificationWeekIdentity,
      converter: notificationWeekConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new NotificationWeekDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

export function notificationWeekCollectionReference(context: FirestoreContext): CollectionGroup<NotificationWeek> {
  return context.collectionGroup(notificationWeekIdentity.collectionName);
}

export type NotificationWeekFirestoreCollectionGroup = FirestoreCollectionGroup<NotificationWeek, NotificationWeekDocument>;

export function notificationWeekFirestoreCollectionGroup(firestoreContext: FirestoreContext): NotificationWeekFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: notificationWeekIdentity,
    converter: notificationWeekConverter,
    queryLike: notificationWeekCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationWeekDocument(accessor, documentAccessor),
    firestoreContext
  });
}
