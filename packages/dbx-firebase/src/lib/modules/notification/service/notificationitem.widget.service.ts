import { Injectable, inject } from '@angular/core';
import { NotificationTemplateType } from '@dereekb/firebase';
import { DbxFirebaseNotificationTemplateService } from './notification.template.service';
import { DbxWidgetEntry, DbxWidgetService } from '@dereekb/dbx-web';
import { DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE, DbxFirebaseNotificationItemWidgetEntry, DbxFirebaseNotificationItemWidgetEntryRegistration, dbxWidgetTypeForNotificationTemplateType } from './notificationitem.widget';

/**
 * Service used for registering widgets used for notification items.
 */
@Injectable()
export class DbxFirebaseNotificationItemWidgetService {
  readonly dbxWidgetService = inject(DbxWidgetService);
  readonly dbxFirebaseNotificationTemplateService = inject(DbxFirebaseNotificationTemplateService);

  private readonly _entries = new Map<NotificationTemplateType, DbxFirebaseNotificationItemWidgetEntry>();

  /**
   * Used to register a item widget. If widget for the given type is already registered, this will override it by default.
   *
   * @param provider
   * @param override
   */
  register(provider: DbxFirebaseNotificationItemWidgetEntryRegistration, override: boolean = true): boolean {
    const { componentClass, notificationTemplateType } = provider;
    const widgetType = dbxWidgetTypeForNotificationTemplateType(notificationTemplateType);

    if (override || !this._entries.has(notificationTemplateType)) {
      const notificationTemplateTypeInfo = this.dbxFirebaseNotificationTemplateService.appNotificationTemplateTypeInfoRecordService.appNotificationTemplateTypeInfoRecord[notificationTemplateType];

      if (!notificationTemplateTypeInfo) {
        console.warn(`DbxFirebaseNotificationItemWidgetService.register(): No known template type info was found for notification type: ${notificationTemplateType}. The entry is not being registered.`);
      } else {
        const entry: DbxFirebaseNotificationItemWidgetEntry = {
          notificationTemplateType,
          notificationTemplateTypeInfo,
          widget: {
            type: widgetType,
            componentClass
          }
        };

        this._entries.set(notificationTemplateType, entry);
        this.dbxWidgetService.register(entry.widget, override);
        return true;
      }
    }

    return false;
  }

  registerDefaultWidget(entry: Omit<DbxWidgetEntry, 'type'>, override: boolean = true): boolean {
    return this.dbxWidgetService.register(
      {
        ...entry,
        type: DEFAULT_FIREBASE_NOTIFICATION_ITEM_WIDGET_TYPE
      },
      override
    );
  }
}
