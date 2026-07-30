import { inject, type EnvironmentProviders, makeEnvironmentProviders, provideAppInitializer, type Provider } from '@angular/core';
import { AppNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DbxFirebaseNotificationTemplateService } from './service/notification.template.service';
import { DbxFirebaseNotificationItemWidgetService } from './service/notificationitem.widget.service';
import { DbxFirebaseNotificationItemDefaultViewComponent } from './component/notificationitem.view.default.component';
import { DbxFirebaseNotificationHealthCheckConfig, DbxFirebaseNotificationHealthCheckPresentationServiceConfig } from './service/healthcheck.presentation';
import { type Maybe } from '@dereekb/util';
import { type DbxWidgetEntry } from '@dereekb/dbx-web';

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
  /**
   * App-specific presentation entries for notification health check issue codes.
   *
   * Only needed when the app or one of its delivery providers emits issue codes the library does not
   * know about. The health check UI works without this — an unregistered code falls back to a
   * presentation derived from the finding's own status.
   */
  readonly healthCheckPresentation?: Maybe<DbxFirebaseNotificationHealthCheckPresentationServiceConfig>;
  /**
   * Tuning for the notification health check's throttle windows.
   *
   * Only needed when the app configured different windows on its server. The values are enforced there
   * and merely counted down here, so they must be the same on both sides — pass the app's own shared
   * constants rather than repeating the numbers.
   */
  readonly healthCheck?: Maybe<DbxFirebaseNotificationHealthCheckConfig>;
}

/**
 * Creates EnvironmentProviders that provides a DbxFirebaseNotificationTemplateService, DbxFirebaseNotificationItemWidgetService and AppNotificationTemplateTypeInfoRecordService.
 *
 * @param config - Configuration.
 * @returns EnvironmentProviders.
 */
export function provideDbxFirebaseNotifications(config: ProvideDbxFirebaseNotificationsConfig): EnvironmentProviders {
  const { appNotificationTemplateTypeInfoRecordService, healthCheckPresentation, healthCheck } = config;

  const providers: (EnvironmentProviders | Provider)[] = [
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
    provideAppInitializer(() => {
      const dbxFirebaseNotificationItemWidgetService = inject(DbxFirebaseNotificationItemWidgetService);

      // register the default widget
      if (config.defaultNotificationItemWidget !== false) {
        const widget = config.defaultNotificationItemWidget ?? DbxFirebaseNotificationItemDefaultViewComponent;

        dbxFirebaseNotificationItemWidgetService.registerDefaultWidget({
          componentClass: widget
        });
      }
    })
  ];

  if (healthCheckPresentation) {
    providers.push({
      provide: DbxFirebaseNotificationHealthCheckPresentationServiceConfig,
      useValue: healthCheckPresentation
    });
  }

  if (healthCheck) {
    providers.push({
      provide: DbxFirebaseNotificationHealthCheckConfig,
      useValue: healthCheck
    });
  }

  return makeEnvironmentProviders(providers);
}
