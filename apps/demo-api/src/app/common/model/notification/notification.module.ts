import { Module } from '@nestjs/common';
import { AbstractAppNotificationModule, BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, NotificationSendService, NotificationTaskService, NotificationTemplateService, type NotificationUserHealthCheckServerConfig, appNotificationModuleMetadata } from '@dereekb/firebase-server/model';
import { DEMO_NOTIFICATION_HEALTH_CHECK_PROBE_THROTTLE_MINUTES, DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES, DEMO_NOTIFICATION_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS } from 'demo-firebase';
import { DemoFirebaseServerActionsContextWithNotificationServices } from './notification.action.context';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { demoNotificationTemplateServiceConfigsArrayFactory } from './notification.factory';
import { DemoApiActionModule } from '../../firebase/action.module';
import { demoNotificationSendServiceFactory } from './notification.send.service';
import { demoNotificationInitServerActionsContextConfig } from './notification.init';
import { demoNotificationTaskServiceFactory } from './notification.task.service';
import { OPENROUTER_RUN_TASK_SERVICE_TOKEN } from '@dereekb/openrouter/firebase-server';
import { DemoApiOpenRouterDependencyModule } from '../../../api/openrouter';

/**
 * The demo's delivery health check windows.
 *
 * Both values come from demo-firebase because the demo app configures its client with the same two
 * constants — the server enforces these windows and the client counts down to them, so they cannot be
 * allowed to drift apart.
 */
export const DEMO_NOTIFICATION_USER_HEALTH_CHECK_CONFIG: NotificationUserHealthCheckServerConfig = {
  probeThrottleMinutes: DEMO_NOTIFICATION_HEALTH_CHECK_PROBE_THROTTLE_MINUTES,
  runThrottleMinutes: DEMO_NOTIFICATION_HEALTH_CHECK_RUN_THROTTLE_MINUTES,
  verifyThrottleSeconds: DEMO_NOTIFICATION_HEALTH_CHECK_VERIFY_THROTTLE_SECONDS
};

// eslint-disable-next-line @typescript-eslint/max-params
export const demoFirebaseServerActionsContextWithNotificationServicesFactory = (context: DemoFirebaseServerActionsContext, notificationTemplateService: NotificationTemplateService, notificationSendService: NotificationSendService, notificationTaskService: NotificationTaskService) => ({ ...context, notificationTemplateService, notificationSendService, notificationTaskService, notificationUserHealthCheckConfig: DEMO_NOTIFICATION_USER_HEALTH_CHECK_CONFIG });

/**
 * Dependencies for the NotificationModule
 */
@Module({
  // DemoApiOpenRouterDependencyModule supplies the run-task queue the `resume` storage-file purpose
  // enqueues into. Imported here rather than in the model module because the task service is what needs
  // it, and the task service is built here.
  imports: [DemoApiActionModule, DemoApiOpenRouterDependencyModule],
  providers: [
    {
      provide: NotificationSendService,
      useFactory: demoNotificationSendServiceFactory,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: NotificationTaskService,
      useFactory: demoNotificationTaskServiceFactory,
      inject: [DemoFirebaseServerActionsContext, OPENROUTER_RUN_TASK_SERVICE_TOKEN]
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
  exports: [DemoApiActionModule, NotificationSendService, NotificationTaskService, BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN]
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
        inject: [DemoFirebaseServerActionsContext, NotificationTemplateService, NotificationSendService, NotificationTaskService]
      }
    ],
    exports: [DemoFirebaseServerActionsContextWithNotificationServices]
  })
)
export class NotificationModule extends AbstractAppNotificationModule {}
