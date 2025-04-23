import { Module } from '@nestjs/common';
import { BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, NotificationSendService, NotificationTemplateService, appNotificationModuleMetadata } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices } from './notification.action.context';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { APP_CODE_PREFIX_LOWERNotificationTemplateServiceConfigsArrayFactory } from './notification.factory';
import { APP_CODE_PREFIXApiActionModule } from '../../firebase/action.module';
import { APP_CODE_PREFIX_LOWERNotificationSendServiceFactory } from './notification.send.service';
import { APP_CODE_PREFIX_LOWERNotificationInitServerActionsContextConfig } from './notification.init';

export const APP_CODE_PREFIX_LOWERFirebaseServerActionsContextWithNotificationServicesFactory = (context: APP_CODE_PREFIXFirebaseServerActionsContext, notificationTemplateService: NotificationTemplateService) => ({ ...context, notificationTemplateService });

/**
 * Dependencies for the NotificationModule
 */
@Module({
  imports: [APP_CODE_PREFIXApiActionModule],
  providers: [
    {
      provide: NotificationSendService,
      useFactory: APP_CODE_PREFIX_LOWERNotificationSendServiceFactory,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    },
    {
      provide: BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: APP_CODE_PREFIXFirebaseServerActionsContext
    },
    {
      provide: NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN,
      useFactory: APP_CODE_PREFIX_LOWERNotificationInitServerActionsContextConfig,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    },
    {
      provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN,
      useFactory: APP_CODE_PREFIX_LOWERNotificationTemplateServiceConfigsArrayFactory,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    }
  ],
  exports: [APP_CODE_PREFIXApiActionModule, NotificationSendService, BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN]
})
export class NotificationDependencyModule {}

/**
 * Notification model module
 */
@Module(
  appNotificationModuleMetadata({
    dependencyModule: NotificationDependencyModule,
    providers: [
      {
        provide: APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices,
        useFactory: APP_CODE_PREFIX_LOWERFirebaseServerActionsContextWithNotificationServicesFactory,
        inject: [APP_CODE_PREFIXFirebaseServerActionsContext, NotificationTemplateService]
      }
    ],
    exports: [APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices]
  })
)
export class NotificationModule {}
