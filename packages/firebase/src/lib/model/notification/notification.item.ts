/**
 * @module notification.item
 *
 * Defines the {@link NotificationItem} embedded data structure that carries notification content
 * across multiple document types ({@link Notification}, {@link NotificationWeek}, {@link NotificationSummary}).
 */
import { separateValues, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type FirestoreModelKey, firestoreSubObject, firestoreModelIdString, firestoreDate, optionalFirestoreUID, firestoreString, optionalFirestoreString, firestorePassThroughField, optionalFirestoreBoolean, type SavedToFirestoreIfTrue } from '../../common';
import { type NotificationTaskType, type NotificationId, type NotificationTemplateType } from './notification.id';
import { isAfter } from 'date-fns';
import { sortByDateFunction } from '@dereekb/date';

/**
 * Arbitrary metadata attached to a {@link NotificationItem}. Content is defined by the concrete notification/task type.
 *
 * Stored directly in Firestore, so values must be Firestore-compatible (no class instances, functions, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- values are arbitrary Firestore-compatible data
export type NotificationItemMetadata = Readonly<Record<string, any>>;

/**
 * Pairs a {@link NotificationItem} with its resolved subject and message strings for display.
 */
export interface NotificationItemSubjectMessagePair<D extends NotificationItemMetadata = NotificationItemMetadata> {
  readonly item: NotificationItem<D>;
  readonly subject: string;
  readonly message: string;
  readonly date: Date;
}

/**
 * Embeddable notification content carried inside {@link Notification}, {@link NotificationWeek}, and {@link NotificationSummary} documents.
 *
 * Each item has a template/task type (`t`) that determines how the notification is rendered and delivered.
 * The optional `s` (subject) and `g` (message) fields can override the template's defaults.
 *
 * Field abbreviations:
 * - `cat` — created-at timestamp
 * - `t` — template or task type identifier
 * - `cb` — created-by user UID
 * - `m` — target model key
 * - `s` — subject override
 * - `g` — message override
 * - `d` — metadata payload
 * - `v` — viewed/read flag
 */
export interface NotificationItem<D extends NotificationItemMetadata = NotificationItemMetadata> {
  /**
   * Unique notification item identifier.
   */
  id: NotificationId;
  /**
   * Creation timestamp of this notification item.
   */
  cat: Date;
  /**
   * Template type (for standard notifications) or task type (for task notifications).
   * Determines how the notification is rendered and which handler processes it.
   */
  t: NotificationTemplateType | NotificationTaskType;
  /**
   * UID of the user who triggered this notification, if applicable.
   */
  cb?: Maybe<FirebaseAuthUserId>;
  /**
   * Model key of the target object this notification relates to.
   */
  m?: Maybe<FirestoreModelKey>;
  /**
   * Subject text override. Replaces the template's default subject when present.
   */
  s?: Maybe<string>;
  /**
   * Message text override. Replaces the template's default message when present.
   */
  g?: Maybe<string>;
  /**
   * Arbitrary metadata payload. Stored directly in Firestore — keep values serializable and small.
   */
  d?: Maybe<D>;
  /**
   * Read/viewed flag. True if the recipient has seen this notification item.
   */
  v?: Maybe<SavedToFirestoreIfTrue>;
}

/**
 * Firestore sub-object converter for embedding {@link NotificationItem} within parent documents.
 */
export const firestoreNotificationItem = firestoreSubObject<NotificationItem>({
  objectField: {
    fields: {
      id: firestoreModelIdString,
      cat: firestoreDate(),
      cb: optionalFirestoreUID(),
      t: firestoreString(),
      m: optionalFirestoreString(),
      s: optionalFirestoreString(),
      g: optionalFirestoreString(),
      d: firestorePassThroughField(),
      v: optionalFirestoreBoolean({ dontStoreIf: false })
    }
  }
});

/**
 * Result of splitting {@link NotificationItem} entries into read and unread groups.
 */
export interface UnreadNotificationItemsResult<D extends NotificationItemMetadata = NotificationItemMetadata> {
  readonly items: NotificationItem<D>[];
  readonly considerReadIfCreatedBefore?: Maybe<Date>;
  readonly read: NotificationItem<D>[];
  readonly unread: NotificationItem<D>[];
}

/**
 * Separates notification items into read and unread groups based on the `v` (viewed) flag
 * and an optional cutoff date.
 *
 * Items are considered read if their `v` flag is true OR if they were created before the `considerReadIfCreatedBefore` date.
 * This is used with {@link NotificationSummary.rat} to mark all older items as read.
 *
 * @param items - notification items to classify
 * @param considerReadIfCreatedBefore - optional cutoff date; items created at or before this date are treated as read
 * @returns an object containing both the read and unread item arrays along with the input cutoff date
 *
 * @example
 * ```ts
 * const result = unreadNotificationItems(summary.n, summary.rat);
 * console.log(result.unread.length); // number of unread items
 * ```
 */
export function unreadNotificationItems<D extends NotificationItemMetadata = NotificationItemMetadata>(items: NotificationItem<D>[], considerReadIfCreatedBefore?: Maybe<Date>): UnreadNotificationItemsResult<D> {
  const checkIsRead = considerReadIfCreatedBefore != null ? (x: NotificationItem<D>) => Boolean(x.v ?? !isAfter(x.cat, considerReadIfCreatedBefore)) : (x: NotificationItem<D>) => Boolean(x.v);
  const { included: read, excluded: unread } = separateValues<NotificationItem<D>>(items, checkIsRead);

  return {
    items,
    considerReadIfCreatedBefore,
    read,
    unread
  };
}

/**
 * Sort comparator for {@link NotificationItem} arrays. Sorts ascending by creation date (`cat`).
 */
export const sortNotificationItemsFunction = sortByDateFunction<NotificationItem>((x) => x.cat);
