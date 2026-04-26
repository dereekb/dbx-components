/**
 * @module notification
 *
 * Core notification model types and Firestore collection definitions for the multi-channel notification system.
 *
 * The notification system is built around five Firestore document types organized in a hierarchy:
 *
 * - {@link NotificationUser} — Per-user notification preferences and box subscriptions (top-level collection)
 * - {@link NotificationSummary} — Aggregated notification items for a model, identified by two-way flat key (top-level collection)
 * - {@link NotificationBox} — Root notification container for a model, holds recipients and spawns child notifications (top-level collection)
 * - {@link Notification} — Individual notification or async task, child of NotificationBox (subcollection)
 * - {@link NotificationWeek} — Weekly archive of sent notification items, child of NotificationBox (subcollection)
 *
 * Server-side processing is handled by the `NotificationServerActions` service in `@dereekb/firebase-server/model`.
 *
 * @see {@link NotificationFirestoreCollections} for the abstract collection accessor class
 */
import { type E164PhoneNumber, type EmailAddress, type Maybe, type NeedsSyncBoolean } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { inferNotificationBoxRelatedModelKey, type NotificationBoxSendExclusionList, type NotificationBoxId } from './notification.id';
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

/**
 * Abstract class providing access to all notification-related Firestore collections.
 *
 * Implementations provide concrete collection instances wired to a specific {@link FirestoreContext}.
 * Used by both client and server code to access notification documents.
 *
 * @see `NotificationServerActions` in `@dereekb/firebase-server/model` for server-side action processing
 *
 * @dbxModelGroup
 */
export abstract class NotificationFirestoreCollections {
  abstract readonly notificationUserCollection: NotificationUserFirestoreCollection;
  abstract readonly notificationSummaryCollection: NotificationSummaryFirestoreCollection;
  abstract readonly notificationBoxCollection: NotificationBoxFirestoreCollection;
  abstract readonly notificationCollectionFactory: NotificationFirestoreCollectionFactory;
  abstract readonly notificationCollectionGroup: NotificationFirestoreCollectionGroup;
  abstract readonly notificationWeekCollectionFactory: NotificationWeekFirestoreCollectionFactory;
  abstract readonly notificationWeekCollectionGroup: NotificationWeekFirestoreCollectionGroup;
}

/**
 * Union of all notification model identity types, used for type-safe identity discrimination.
 */
export type NotificationTypes = typeof notificationUserIdentity | typeof notificationSummaryIdentity | typeof notificationBoxIdentity | typeof notificationIdentity | typeof notificationWeekIdentity;

/**
 * Notification-related model that is initialized asynchronously at a later time.
 *
 * Examples: NotificationSummary, NotificationBox
 */
export interface InitializedNotificationModel {
  /**
   * True if this model needs to be sync'd/initialized with the original model.
   *
   * Is set false if/when "fi" is set true.
   *
   * @dbxModelVariable needsSync
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * True if this model has been flagged invalid.
   *
   * This is for cases where the model cannot be properly initiialized.
   *
   * NOTE: The server can also be configured to automatically delete these models instead of marking them as invalid.
   *
   * @dbxModelVariable flaggedInvalid
   */
  fi?: Maybe<SavedToFirestoreIfTrue>;
}

// MARK: NotificationUser
export const notificationUserIdentity = firestoreModelIdentity('notificationUser', 'nu');

/**
 * A global notification user profile that tracks notification preferences and box subscriptions.
 *
 * Each user in the notification system has a single NotificationUser document (keyed by uid) that stores:
 * - Which {@link NotificationBox} instances they are subscribed to (`b`)
 * - Per-box, direct/default, and global notification preferences (`bc`, `dc`, `gc`)
 * - Box exclusions for temporary opt-outs (`x`)
 *
 * Created automatically when a user is first added as a recipient to any {@link NotificationBox}.
 * Configuration changes here propagate to the corresponding NotificationBox recipient entries during sync.
 *
 * @see {@link NotificationBoxRecipient} for the per-box recipient entry that mirrors these configs
 * @see `NotificationServerActions.updateNotificationUser` in `@dereekb/firebase-server/model` for server-side sync logic
 *
 * @dbxModel
 */
export interface NotificationUser extends UserRelated, UserRelatedById {
  /**
   * Notification box IDs this user is subscribed to. Managed by the server — not directly editable by clients.
   *
   * @dbxModelVariable boxes
   */
  b: NotificationBoxId[];
  /**
   * Box exclusion list. Entries cause the user to be excluded from receiving notifications from matching boxes.
   *
   * Supports prefix matching: excluding `ab_123` also excludes child boxes like `ab_123_cd_456`.
   * Populated by server-side model logic (e.g., when a user loses access to a resource).
   * Exclusions are synced to the corresponding `bc` configs, which then propagate to the NotificationBoxes.
   *
   * Non-matching entries (where the user isn't associated with a matching box) are automatically removed.
   *
   * @dbxModelVariable boxExclusions
   */
  x: NotificationBoxSendExclusionList;
  /**
   * Global config override. Overrides all other configs (both per-box `bc` and direct/default `dc`) at send time.
   *
   * Unlike `dc`/`bc`, changes to `gc` are NOT copied to other config fields — they apply as a final override during notification delivery.
   *
   * @dbxModelVariable globalConfig
   */
  gc: NotificationUserDefaultNotificationBoxRecipientConfig;
  /**
   * Direct/default config. Used when a recipient is added ad-hoc (by uid) to a notification that isn't associated with any of their subscribed boxes.
   *
   * Acts as the fallback config when no per-box config (`bc`) matches.
   *
   * @dbxModelVariable defaultConfig
   */
  dc: NotificationUserDefaultNotificationBoxRecipientConfig;
  /**
   * Per-box recipient configurations. Each entry corresponds to one of the user's subscribed notification boxes.
   *
   * These configs are synced bidirectionally with the {@link NotificationBoxRecipient} entries on the corresponding {@link NotificationBox}.
   *
   * @dbxModelVariable boxConfigs
   */
  bc: NotificationUserNotificationBoxRecipientConfig[];
  /**
   * Whether one or more configs need to be synced to their corresponding NotificationBox recipients.
   *
   * @dbxModelVariable needsConfigSync
   */
  ns?: Maybe<NeedsSyncBoolean>;
}

export type NotificationUserRoles = 'sync' | GrantedUpdateRole | GrantedReadRole;

export class NotificationUserDocument extends AbstractFirestoreDocument<NotificationUser, NotificationUserDocument, typeof notificationUserIdentity> {
  get modelIdentity() {
    return notificationUserIdentity;
  }
}

/**
 * Firestore snapshot converter for {@link NotificationUser} documents.
 */
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

/**
 * Creates a Firestore collection reference for {@link NotificationUser} documents.
 *
 * @param context - Firestore context to create the collection reference from
 * @returns a typed collection reference for NotificationUser documents
 */
export function notificationUserCollectionReference(context: FirestoreContext): CollectionReference<NotificationUser> {
  return context.collection(notificationUserIdentity.collectionName);
}

/**
 * Typed Firestore collection for {@link NotificationUser} documents.
 */
export type NotificationUserFirestoreCollection = FirestoreCollection<NotificationUser, NotificationUserDocument>;

/**
 * Creates a typed {@link NotificationUserFirestoreCollection} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection to
 * @returns a typed Firestore collection for NotificationUser documents
 */
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
 * Identity for {@link NotificationSummary} documents. Collection name: `'notificationSummary'`, short code: `'ns'`.
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
 * Aggregated notification feed for a specific model. Holds embedded {@link NotificationItem} entries
 * that summarize recent notifications, similar to an activity feed.
 *
 * The document ID is a two-way flat key derived from the model it represents (see {@link notificationSummaryIdForModel}).
 * Items are capped at {@link NOTIFICATION_SUMMARY_ITEM_LIMIT} entries.
 *
 * Implements {@link InitializedNotificationModel} — requires server-side initialization to populate the owner (`o`) field.
 *
 * @dbxModel
 */
export interface NotificationSummary extends InitializedNotificationModel {
  /**
   * Creation date of this summary document.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Model key of the model this summary represents (e.g., `'project/abc123'`).
   *
   * @dbxModelVariable modelKey
   */
  m: FirestoreModelKey;
  /**
   * Owner model key. Set to a dummy value on creation and populated during server-side initialization.
   *
   * @dbxModelVariable ownerKey
   */
  o: FirestoreModelKey;
  /**
   * Embedded notification items, sorted ascending by date (newest at end).
   *
   * @dbxModelVariable notifications
   */
  n: NotificationItem[];
  /**
   * Timestamp of the most recently added notification item.
   *
   * @dbxModelVariable lastNotificationAt
   */
  lat?: Maybe<Date>;
  /**
   * Timestamp of when the user last read this summary. Items with dates after this are considered unread.
   *
   * @dbxModelVariable lastReadAt
   */
  rat?: Maybe<Date>;
  /**
   * Whether this summary needs server-side sync/initialization with its source model.
   *
   * @dbxModelVariable needsSync
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

/**
 * Firestore snapshot converter for {@link NotificationSummary} documents.
 */
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
    s: optionalFirestoreBoolean({ dontStoreIf: false }),
    fi: optionalFirestoreBoolean({ dontStoreIf: false })
  }
});

/**
 * Creates a Firestore collection reference for {@link NotificationSummary} documents.
 *
 * @param context - Firestore context to create the collection reference from
 * @returns a typed collection reference for NotificationSummary documents
 */
export function notificationSummaryCollectionReference(context: FirestoreContext): CollectionReference<NotificationSummary> {
  return context.collection(notificationSummaryIdentity.collectionName);
}

/**
 * Typed Firestore collection for {@link NotificationSummary} documents.
 */
export type NotificationSummaryFirestoreCollection = FirestoreCollection<NotificationSummary, NotificationSummaryDocument>;

/**
 * Creates a typed {@link NotificationSummaryFirestoreCollection} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection to
 * @returns a typed Firestore collection for NotificationSummary documents
 */
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
/**
 * Identity for {@link NotificationBox} documents. Collection name: `'notificationBox'`, short code: `'nb'`.
 */
export const notificationBoxIdentity = firestoreModelIdentity('notificationBox', 'nb');

/**
 * Root notification container for a model. The document ID is the two-way flat key of the model it represents
 * (see {@link notificationBoxIdForModel} in `notification.id.ts`).
 *
 * A NotificationBox is the parent collection for {@link Notification} and {@link NotificationWeek} subcollections.
 * It holds the list of recipients (`r`) who receive notifications, and tracks which notification template types
 * are available via the application's `NotificationTemplateTypeInfoRecord`.
 *
 * Recipient configs are synced from the corresponding {@link NotificationUser} documents.
 *
 * Implements {@link InitializedNotificationModel} — requires server-side initialization to populate the owner (`o`) field.
 *
 * @see {@link NotificationBoxRecipient} for per-recipient configuration embedded in this document
 * @see `NotificationServerActions.createNotificationBox` in `@dereekb/firebase-server/model` for creation logic
 *
 * @dbxModel
 */
export interface NotificationBox extends InitializedNotificationModel {
  /**
   * Creation date of this NotificationBox document.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Model key of the model this box is assigned to (e.g., `'project/abc123'`).
   *
   * @dbxModelVariable modelKey
   */
  m: FirestoreModelKey;
  /**
   * Owner model key. Set to a dummy value on creation and populated during server-side initialization.
   *
   * @dbxModelVariable ownerKey
   */
  o: FirestoreModelKey;
  /**
   * Embedded recipient entries. Each entry represents a user who can receive notifications from this box.
   *
   * Synced from the corresponding {@link NotificationUser} `bc` configs.
   *
   * @dbxModelVariable recipients
   */
  r: NotificationBoxRecipient[];
  /**
   * Year-week code of the latest {@link NotificationWeek} subcollection document.
   *
   * @dbxModelVariable latestWeek
   */
  w: YearWeekCode;
  /**
   * Whether this box needs server-side sync/initialization with its source model.
   * Cleared when `fi` is set true (flagged invalid).
   *
   * @dbxModelVariable needsSync
   */
  s?: Maybe<NeedsSyncBoolean>;
  /**
   * Flagged invalid — set when the box cannot be properly initialized (e.g., source model deleted).
   *
   * The server can be configured to either flag or auto-delete invalid boxes.
   *
   * @dbxModelVariable flaggedInvalid
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

/**
 * Firestore snapshot converter for {@link NotificationBox} documents.
 */
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

/**
 * Creates a Firestore collection reference for {@link NotificationBox} documents.
 *
 * @param context - Firestore context to create the collection reference from
 * @returns a typed collection reference for NotificationBox documents
 */
export function notificationBoxCollectionReference(context: FirestoreContext): CollectionReference<NotificationBox> {
  return context.collection(notificationBoxIdentity.collectionName);
}

/**
 * Typed Firestore collection for {@link NotificationBox} documents.
 */
export type NotificationBoxFirestoreCollection = FirestoreCollection<NotificationBox, NotificationBoxDocument>;

/**
 * Creates a typed {@link NotificationBoxFirestoreCollection} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection to
 * @returns a typed Firestore collection for NotificationBox documents
 */
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
/**
 * Identity for {@link Notification} documents. Subcollection of {@link NotificationBox}. Collection name: `'notification'`, short code: `'nbn'`.
 */
export const notificationIdentity = firestoreModelIdentity(notificationBoxIdentity, 'notification', 'nbn');

/**
 * Controls how a {@link Notification} interacts with its parent {@link NotificationBox} during delivery.
 *
 * Determines whether the box must exist, should be created on demand, or can be bypassed entirely.
 * Task-type notifications (`TASK_NOTIFICATION`) bypass the box system and run async workflows instead.
 */
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

/**
 * Lifecycle state of a notification delivery channel (text, email, push, or summary).
 *
 * Each channel on a {@link Notification} tracks its own send state independently via {@link NotificationSendFlags}.
 *
 * State transitions:
 * - `QUEUED` → `SENT` (success) | `SENT_PARTIAL` (partial success) | `SEND_ERROR` | `BUILD_ERROR` | `CONFIG_ERROR`
 * - `QUEUED` → `SKIPPED` (box settings) | `NO_TRY` (permanently skipped)
 * - `NONE` indicates the channel was never queued for this notification
 */
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

/**
 * Per-channel delivery state flags on a {@link Notification}. Each field tracks the send state for one delivery channel independently.
 */
export interface NotificationSendFlags {
  /**
   * Text/SMS send state.
   *
   * @dbxModelVariable textSendState
   */
  ts: NotificationSendState;
  /**
   * Email send state.
   *
   * @dbxModelVariable emailSendState
   */
  es: NotificationSendState;
  /**
   * Push notification send state.
   *
   * @dbxModelVariable pushSendState
   */
  ps: NotificationSendState;
  /**
   * In-app notification summary send state (delivery to {@link NotificationSummary}).
   *
   * @dbxModelVariable summarySendState
   */
  ns: NotificationSendState;
  /**
   * Recipient send flag controlling who receives this notification and whether it should be archived to {@link NotificationWeek} after delivery.
   *
   * @dbxModelVariable recipientSendFlag
   */
  rf?: Maybe<NotificationRecipientSendFlag>;
}

/**
 * Arbitrary unique string that denotes checkpoint progress for a multi-step task.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationTaskCheckpointString = string;

/**
 * Tracks delivery progress for a {@link Notification} to enable idempotent retries.
 *
 * Stores which recipients have already been contacted via each channel, plus task checkpoint progress.
 * The server checks these sets before re-sending to avoid duplicate deliveries.
 */
export interface NotificationSendCheckpoints {
  /**
   * Phone numbers that have already received the text/SMS for this notification.
   *
   * @dbxModelVariable textRecipients
   */
  tsr: E164PhoneNumber[];
  /**
   * Email addresses that have already received the email for this notification.
   *
   * @dbxModelVariable emailRecipients
   */
  esr: EmailAddress[];
  /**
   * Completed checkpoint strings for multi-step task notifications.
   *
   * @see {@link NotificationTaskCheckpointString}
   *
   * @dbxModelVariable taskCheckpoints
   */
  tpr: NotificationTaskCheckpointString[];
}

/**
 * Individual notification document, stored as a subcollection of {@link NotificationBox}.
 *
 * Represents either a standard multi-channel notification or an async task notification, depending on the {@link NotificationSendType}.
 * Standard notifications are delivered via text, email, push, and/or in-app summary channels.
 * Task notifications run server-side async workflows with checkpoint-based progress tracking.
 *
 * After all channels are delivered, the notification is marked as done (`d = true`), its content is archived
 * to a {@link NotificationWeek} document, and the notification document is deleted.
 *
 * @see {@link NotificationSendFlags} for per-channel delivery state
 * @see {@link NotificationSendCheckpoints} for idempotent retry tracking
 * @see `NotificationServerActions.sendQueuedNotifications` in `@dereekb/firebase-server/model` for the send pipeline
 *
 * @dbxModel
 */
export interface Notification extends NotificationSendFlags, NotificationSendCheckpoints {
  /**
   * Creation timestamp.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Send type controlling how this notification interacts with its parent NotificationBox.
   *
   * @dbxModelVariable sendType
   */
  st: NotificationSendType;
  /**
   * Embedded notification content (subject, message, template type, metadata).
   *
   * @dbxModelVariable notificationItem
   */
  n: NotificationItem;
  /**
   * Additional per-notification recipients with inline config overrides.
   *
   * Any `NotificationBoxRecipientTemplateConfig` values on these recipients affect opt-in/opt-out resolution.
   * For example, setting `st: true` opts a user into text/SMS for this notification's template type,
   * unless overridden by the user's own {@link NotificationUser} config.
   *
   * @dbxModelVariable recipients
   */
  r: NotificationRecipientWithConfig[];
  /**
   * Explicit opt-in send only. When true, only sends to users who have explicitly opted in for each channel.
   *
   * Overrides the system-level default for this notification's template type.
   *
   * @dbxModelVariable optInSendOnly
   */
  ois?: Maybe<SavedToFirestoreIfTrue>;
  /**
   * Opt-in text/SMS override. When false, sends text/SMS to all users even if they haven't explicitly opted in
   * (still respects explicit opt-outs).
   *
   * Overrides the system-level default for this notification's template type.
   *
   * @dbxModelVariable optInTextSend
   */
  ots?: Maybe<SavedToFirestoreIfFalse>;
  /**
   * Scheduled send time. The notification is guaranteed to be sent only after this time.
   *
   * Also serves as a lock mechanism: during active sending, `sat` is pushed forward by a few minutes
   * and the attempt counter is incremented, preventing concurrent send attempts.
   *
   * @dbxModelVariable sendAt
   */
  sat: Date;
  /**
   * Total error attempt count. Incremented only when sending encounters an error (not on success).
   *
   * @dbxModelVariable attempts
   */
  a: number;
  /**
   * Current task attempt count for the active checkpoint. Incremented on delay or failure responses.
   *
   * Reset to 0 when a checkpoint completes successfully or when a new checkpoint begins.
   *
   * @dbxModelVariable taskAttempts
   */
  at?: Maybe<number>;
  /**
   * Delivery complete flag. When true, content has been delivered and is ready to archive to {@link NotificationWeek}.
   *
   * For task-type notifications this is always false — tasks are deleted upon completion instead of archived.
   *
   * @dbxModelVariable done
   */
  d: boolean;
  /**
   * Unique task flag. Only used for task-type notifications.
   *
   * When true, the server re-reads the document and compares `cat` before committing a task step.
   * If `cat` has changed (indicating the task was replaced), the step is abandoned silently.
   * This prevents stale task executions when a unique task ID is reused.
   *
   * @dbxModelVariable uniqueTask
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

/**
 * Firestore snapshot converter for {@link Notification} documents.
 */
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

/**
 * Creates a factory that produces {@link Notification} subcollection references for a given {@link NotificationBoxDocument} parent.
 *
 * @param context - Firestore context to create subcollection references from
 * @returns a factory function that creates collection references for a given NotificationBox parent
 */
export function notificationCollectionReferenceFactory(context: FirestoreContext): (notificationBox: NotificationBoxDocument) => CollectionReference<Notification> {
  return (notificationBox: NotificationBoxDocument) => {
    return context.subcollection(notificationBox.documentRef, notificationIdentity.collectionName);
  };
}

/**
 * Typed Firestore subcollection for {@link Notification} documents under a {@link NotificationBox} parent.
 */
export type NotificationFirestoreCollection = FirestoreCollectionWithParent<Notification, NotificationBox, NotificationDocument, NotificationBoxDocument>;

/**
 * Factory function that creates a {@link NotificationFirestoreCollection} for a given {@link NotificationBoxDocument} parent.
 */
export type NotificationFirestoreCollectionFactory = (parent: NotificationBoxDocument) => NotificationFirestoreCollection;

/**
 * Creates a {@link NotificationFirestoreCollectionFactory} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection factory to
 * @returns a factory that creates typed Firestore subcollections for Notification documents
 */
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

/**
 * Creates a collection group reference for querying all {@link Notification} documents across all {@link NotificationBox} parents.
 *
 * @param context - Firestore context to create the collection group reference from
 * @returns a typed collection group for querying Notification documents across all parents
 */
export function notificationCollectionReference(context: FirestoreContext): CollectionGroup<Notification> {
  return context.collectionGroup(notificationIdentity.collectionName);
}

/**
 * Typed collection group for querying {@link Notification} documents across all parents.
 */
export type NotificationFirestoreCollectionGroup = FirestoreCollectionGroup<Notification, NotificationDocument>;

/**
 * Creates a typed {@link NotificationFirestoreCollectionGroup} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection group to
 * @returns a typed Firestore collection group for querying Notification documents across all parents
 */
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
/**
 * Identity for {@link NotificationWeek} documents. Subcollection of {@link NotificationBox}. Collection name: `'notificationWeek'`, short code: `'nbnw'`.
 */
export const notificationWeekIdentity = firestoreModelIdentity(notificationBoxIdentity, 'notificationWeek', 'nbnw');

/**
 * The maximum number of notifications that can be stored in a NotificationWeek.
 */
export const NOTIFICATION_WEEK_NOTIFICATION_ITEM_LIMIT = 5000;

/**
 * Weekly archive of delivered notification items within a {@link NotificationBox}.
 *
 * The document ID is the {@link YearWeekCode} string (same as the `w` field). Items are appended after
 * a {@link Notification} completes delivery and is cleaned up. Capped at {@link NOTIFICATION_WEEK_NOTIFICATION_ITEM_LIMIT} items.
 *
 * Used for historical browsing of past notifications per box.
 *
 * @dbxModel
 */
export interface NotificationWeek {
  /**
   * Year-week code identifying this week. Matches the document ID.
   *
   * @dbxModelVariable yearWeek
   */
  w: YearWeekCode;
  /**
   * Archived notification items delivered during this week.
   *
   * @dbxModelVariable notifications
   */
  n: NotificationItem[];
}

export type NotificationWeekRoles = GrantedReadRole;

export class NotificationWeekDocument extends AbstractFirestoreDocumentWithParent<NotificationBox, NotificationWeek, NotificationWeekDocument, typeof notificationWeekIdentity> {
  get modelIdentity() {
    return notificationWeekIdentity;
  }
}

/**
 * Firestore snapshot converter for {@link NotificationWeek} documents.
 */
export const notificationWeekConverter = snapshotConverterFunctions<NotificationWeek>({
  fields: {
    w: firestoreNumber({ default: UNKNOWN_YEAR_WEEK_CODE }),
    n: firestoreObjectArray({
      objectField: firestoreNotificationItem
    })
  }
});

/**
 * Creates a factory that produces {@link NotificationWeek} subcollection references for a given {@link NotificationBoxDocument} parent.
 *
 * @param context - Firestore context to create subcollection references from
 * @returns a factory function that creates collection references for a given NotificationBox parent
 */
export function notificationWeekCollectionReferenceFactory(context: FirestoreContext): (notificationBox: NotificationBoxDocument) => CollectionReference<NotificationWeek> {
  return (notificationBox: NotificationBoxDocument) => {
    return context.subcollection(notificationBox.documentRef, notificationWeekIdentity.collectionName);
  };
}

/**
 * Typed Firestore subcollection for {@link NotificationWeek} documents under a {@link NotificationBox} parent.
 */
export type NotificationWeekFirestoreCollection = FirestoreCollectionWithParent<NotificationWeek, NotificationBox, NotificationWeekDocument, NotificationBoxDocument>;

/**
 * Factory function that creates a {@link NotificationWeekFirestoreCollection} for a given {@link NotificationBoxDocument} parent.
 */
export type NotificationWeekFirestoreCollectionFactory = (parent: NotificationBoxDocument) => NotificationWeekFirestoreCollection;

/**
 * Creates a {@link NotificationWeekFirestoreCollectionFactory} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection factory to
 * @returns a factory that creates typed Firestore subcollections for NotificationWeek documents
 */
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

/**
 * Creates a collection group reference for querying all {@link NotificationWeek} documents across all {@link NotificationBox} parents.
 *
 * @param context - Firestore context to create the collection group reference from
 * @returns a typed collection group for querying NotificationWeek documents across all parents
 */
export function notificationWeekCollectionReference(context: FirestoreContext): CollectionGroup<NotificationWeek> {
  return context.collectionGroup(notificationWeekIdentity.collectionName);
}

/**
 * Typed collection group for querying {@link NotificationWeek} documents across all parents.
 */
export type NotificationWeekFirestoreCollectionGroup = FirestoreCollectionGroup<NotificationWeek, NotificationWeekDocument>;

/**
 * Creates a typed {@link NotificationWeekFirestoreCollectionGroup} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection group to
 * @returns a typed Firestore collection group for querying NotificationWeek documents across all parents
 */
export function notificationWeekFirestoreCollectionGroup(firestoreContext: FirestoreContext): NotificationWeekFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: notificationWeekIdentity,
    converter: notificationWeekConverter,
    queryLike: notificationWeekCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationWeekDocument(accessor, documentAccessor),
    firestoreContext
  });
}
