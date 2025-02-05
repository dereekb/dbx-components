import { Maybe } from '@dereekb/util';
import { FirebaseAuthUserId, FirestoreModelKey, firestoreSubObject, firestoreModelIdString, firestoreDate, optionalFirestoreUID, firestoreString, optionalFirestoreString, firestorePassThroughField } from '../../common';
import { NotificationId, NotificationTemplateType } from './notification.id';

/**
 * Arbitrary metadata for a job. Derived/managed by the concrete job type.
 */
export type NotificationItemMetadata = Readonly<Record<string, any>>;

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
      d: firestorePassThroughField()
    }
  }
});
