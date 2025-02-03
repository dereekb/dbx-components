import { Module } from '@nestjs/common';
import { BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, NotificationSendService, NotificationTemplateService, appNotificationModuleMetadata } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContextWithNotificationServices } from './notification.action.context';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { demoNotificationTemplateServiceConfigsArrayFactory } from './notification.factory';
import { DemoApiActionModule } from '../../firebase/action.module';
import { demoNotificationSendServiceFactory } from './notification.send.service';
import { demoNotificationInitServerActionsContextConfig } from './notification.init';

export const demoFirebaseServerActionsContextWithNotificationServicesFactory = (context: DemoFirebaseServerActionsContext, notificationTemplateService: NotificationTemplateService) => ({ ...context, notificationTemplateService });

/**
 * Dependencies for the NotificationModule
 */
@Module({
  imports: [DemoApiActionModule],
  providers: [
    {
      provide: NotificationSendService,
      useFactory: demoNotificationSendServiceFactory,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: DemoFirebaseServerActionsContext
    },
    {
      provide: NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN,
      useFactory: demoNotificationInitServerActionsContextConfig,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN,
      useFactory: demoNotificationTemplateServiceConfigsArrayFactory,
      inject: [DemoFirebaseServerActionsContext]
    }
  ],
  exports: [DemoApiActionModule, NotificationSendService, BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN]
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
        provide: DemoFirebaseServerActionsContextWithNotificationServices,
        useFactory: demoFirebaseServerActionsContextWithNotificationServicesFactory,
        inject: [DemoFirebaseServerActionsContext, NotificationTemplateService]
      }
    ],
    exports: [DemoFirebaseServerActionsContextWithNotificationServices]
  })
)
export class NotificationModule {}
