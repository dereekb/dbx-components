import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { AppNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DbxFirebaseNotificationTemplateService } from './service/notification.template.service';
import { DbxFirebaseNotificationItemWidgetService } from './service/notificationitem.widget.service';
import { DbxFirebaseNotificationItemDefaultViewComponent } from './component/notificationitem.view.default.component';
import { DbxWidgetEntry } from '@dereekb/dbx-web';

/**
 * Configuration for DbxFirebaseNotificationModule.
 */
export interface ProvideDbxFirebaseNotificationsConfig {
  readonly appNotificationTemplateTypeInfoRecordService: AppNotificationTemplateTypeInfoRecordService;
  /**
   * The default notification item widget to register with the DbxFirebaseNotificationItemWidgetService.
   *
   * If not defined, will automatically register the default widget.
   *
   * If false, will not register anything.
   */
  readonly defaultNotificationItemWidget?: DbxWidgetEntry['componentClass'] | false;
}

/**
 * Creates EnvironmentProviders that provides a DbxFirebaseNotificationTemplateService, DbxFirebaseNotificationItemWidgetService and AppNotificationTemplateTypeInfoRecordService.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseNotifications(config: ProvideDbxFirebaseNotificationsConfig): EnvironmentProviders {
  const { appNotificationTemplateTypeInfoRecordService } = config;

  const providers: Provider[] = [
    {
      provide: AppNotificationTemplateTypeInfoRecordService,
      useValue: appNotificationTemplateTypeInfoRecordService
    },
    {
      provide: DbxFirebaseNotificationItemWidgetService,
      useClass: DbxFirebaseNotificationItemWidgetService
    },
    {
      provide: DbxFirebaseNotificationTemplateService,
      useClass: DbxFirebaseNotificationTemplateService
    },
    // service initialization
    {
      provide: APP_INITIALIZER,
      useFactory: (dbxFirebaseNotificationItemWidgetService: DbxFirebaseNotificationItemWidgetService) => {
        return () => {
          // register the default widget
          if (config.defaultNotificationItemWidget !== false) {
            const widget = config.defaultNotificationItemWidget ?? DbxFirebaseNotificationItemDefaultViewComponent;

            dbxFirebaseNotificationItemWidgetService.registerDefaultWidget({
              componentClass: widget
            });
          }
        };
      },
      deps: [DbxFirebaseNotificationItemWidgetService],
      multi: true
    }
  ];

  return makeEnvironmentProviders(providers);
}
