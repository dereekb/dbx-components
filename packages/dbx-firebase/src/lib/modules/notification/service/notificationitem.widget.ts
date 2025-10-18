import { type DbxWidgetEntry, type DbxWidgetType } from '@dereekb/dbx-web';
import { type NotificationTemplateType, type NotificationTemplateTypeInfo } from '@dereekb/firebase';

/**
 * Prefix used by all widgets.
 *
 * Does not include the "-" between the prefix and the template type returned by dbxWidgetTypeForNotificationTemplateType().
 */
export const FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE_PREFIX: string = 'dbxFirebaseNotificationItem';

export const DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE: DbxWidgetType = `${FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE_PREFIX}Default`;

export function dbxWidgetTypeForNotificationTemplateType(notificationTemplateType: NotificationTemplateType): DbxWidgetType {
  return `${FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE_PREFIX}-${notificationTemplateType}`;
}

/**
 * Used for registering a DbxFirebaseNotificationItemWidgetEntry.
 *
 * The notificationTemplateType should be known by the app, otherwise a warning may be thrown.
 */
export interface DbxFirebaseNotificationItemWidgetEntryRegistration extends Omit<DbxWidgetEntry, 'type'> {
  readonly notificationTemplateType: NotificationTemplateType;
}

/**
 * A widget used for DbxFirebaseNotificationItem views.
 */
export interface DbxFirebaseNotificationItemWidgetEntry {
  readonly notificationTemplateType: NotificationTemplateType;
  readonly notificationTemplateTypeInfo: NotificationTemplateTypeInfo;
  readonly widget: DbxWidgetEntry;
}
