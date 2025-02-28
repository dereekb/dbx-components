import { separateValues, type Maybe } from '@dereekb/util';
import { type FirebaseAuthUserId, type FirestoreModelKey, firestoreSubObject, firestoreModelIdString, firestoreDate, optionalFirestoreUID, firestoreString, optionalFirestoreString, firestorePassThroughField, optionalFirestoreBoolean, type SavedToFirestoreIfTrue } from '../../common';
import { type NotificationId, type NotificationTemplateType } from './notification.id';
import { isAfter } from 'date-fns';
import { sortByDateFunction } from '@dereekb/date';

/**
 * Arbitrary metadata for a job. Derived/managed by the concrete job type.
 */
export type NotificationItemMetadata = Readonly<Record<string, any>>;

export interface NotificationItemSubjectMessagePair<D extends NotificationItemMetadata = {}> {
  readonly item: NotificationItem<D>;
  readonly subject: string;
  readonly message: string;
  readonly date: Date;
}

/**
 * A notification item.
 *
 * Is embedded within a Notification, NotificationWeek, and NotificationSummary.
 */
export interface NotificationItem<D extends NotificationItemMetadata = {}> {
  /**
   * Unique identifier
   */
  id: NotificationId;
  /**
   * Notification date/time
   */
  cat: Date;
  /**
   * Notification template type.
   */
  t: NotificationTemplateType;
  /**
   * User who created this notification, if applicable.
   */
  cb?: Maybe<FirebaseAuthUserId>;
  /**
   * Model/object that this notification item is targeting.
   */
  m?: Maybe<FirestoreModelKey>;
  /**
   * Subject. Used to overwrite the template's default subject.
   */
  s?: Maybe<string>;
  /**
   * Message. Used to overwrite the template's default message.
   */
  g?: Maybe<string>;
  /**
   * Arbitrary metadata attached to the notification item.
   */
  d?: Maybe<D>;
  /**
   * True if this notification item is marked as read/viewed.
   */
  v?: Maybe<SavedToFirestoreIfTrue>;
}

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

export interface UnreadNotificationItemsResult<D extends NotificationItemMetadata = {}> {
  readonly items: NotificationItem<D>[];
  readonly considerReadIfCreatedBefore?: Maybe<Date>;
  readonly read: NotificationItem<D>[];
  readonly unread: NotificationItem<D>[];
}

/**
 * Returns an object containing input notification items split up by their determined read/unread state.
 *
 * @param items
 */
export function unreadNotificationItems<D extends NotificationItemMetadata = {}>(items: NotificationItem<D>[], considerReadIfCreatedBefore?: Maybe<Date>): UnreadNotificationItemsResult<D> {
  const checkIsRead = considerReadIfCreatedBefore != null ? (x: NotificationItem<D>) => Boolean(x.v || !isAfter(x.cat, considerReadIfCreatedBefore)) : (x: NotificationItem<D>) => Boolean(x.v);
  const { included: read, excluded: unread } = separateValues<NotificationItem<D>>(items, checkIsRead);

  return {
    items,
    considerReadIfCreatedBefore,
    read,
    unread
  };
}

export const sortNotificationItemsFunction = sortByDateFunction<NotificationItem<any>>((x) => x.cat);
