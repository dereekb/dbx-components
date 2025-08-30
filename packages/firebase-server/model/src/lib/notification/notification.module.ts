import { Global, Injectable, Module, type ModuleMetadata } from '@nestjs/common';
import { NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, notificationInitServerActions, NotificationInitServerActions, type NotificationInitServerActionsContextConfig } from './notification.action.init.server';
import { BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, type BaseNotificationServerActionsContext, NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, notificationServerActions, NotificationServerActions, type NotificationServerActionsContext } from './notification.action.server';
import { NotificationTemplateService } from './notification.config.service';
import { type Maybe } from '@dereekb/util';
import { ConfigModule } from '@nestjs/config';
import { NotificationSendService } from './notification.send.service';
import { NotificationTaskService } from './notification.task.service';
import { exportMutableNotificationExpediteService, MutableNotificationExpediteService, NotificationExpediteService, provideMutableNotificationExpediteService } from './notification.expedite.service';

// MARK: Provider Factories
export function notificationServerActionsContextFactory(context: BaseNotificationServerActionsContext, notificationTemplateService: NotificationTemplateService, notificationSendService: NotificationSendService, notificationTaskService: NotificationTaskService, notificationsExpediteService: NotificationExpediteService) {
  return { ...context, notificationTemplateService, notificationSendService, notificationTaskService, notificationsExpediteService };
}

export function notificationServerActionsFactory(context: NotificationServerActionsContext, mutableNotificationExpediteService: MutableNotificationExpediteService) {
  return notificationServerActions(context);
}

export function notificationInitServerActionsFactory(context: NotificationServerActionsContext, notificationInitServerActionsContextConfig: NotificationInitServerActionsContextConfig) {
  return notificationInitServerActions({
    ...context,
    ...notificationInitServerActionsContextConfig
  });
}

// MARK: App Notification Model Module
export interface ProvideAppNotificationMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The AppNotificationModule requires the following dependencies in order to initialze properly:
   * - MutableNotificationExpediteService
   * - NotificationSendService
   * - NotificationTaskService
   * - BaseNotificationServerActionsContext (BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN)
   * - NotificationInitServerActionsContextConfig (NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN)
   * - NotificationTemplateServiceTypeConfigArray (NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN)
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's NotificationModule.
 *
 * By default this module exports:
 * - NotificationServerActionContext (NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN)
 * - NotificationTemplateService
 * - NotificationServerActions
 * - NotificationInitServerActions
 * - NotificationExpediteService (MutableNotificationExpediteService is used as the existing, but it is not re-exported)
 *
 * Be sure the class that delares the module using this function also extends AbstractAppNotificationModule.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appNotificationModuleMetadata(config: ProvideAppNotificationMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationExpediteService, NotificationTemplateService, NotificationServerActions, NotificationInitServerActions, ...(exports ?? [])],
    providers: [
      {
        provide: NotificationExpediteService,
        useExisting: MutableNotificationExpediteService
      },
      {
        provide: NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN,
        useFactory: notificationServerActionsContextFactory,
        inject: [BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationTemplateService, NotificationSendService, NotificationTaskService, NotificationExpediteService]
      },
      {
        provide: NotificationTemplateService,
        useClass: NotificationTemplateService
      },
      {
        provide: NotificationServerActions,
        useFactory: notificationServerActionsFactory,
        inject: [NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationExpediteService]
      },
      {
        provide: NotificationInitServerActions,
        useFactory: notificationInitServerActionsFactory,
        inject: [NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN]
      },
      ...(providers ?? [])
    ]
  };
}

/**
 * Abstract module that should be extended when using appNotificationModuleMetadata.
 */
@Module({})
export abstract class AbstractAppNotificationModule {
  constructor(mutableNotificationExpediteService: MutableNotificationExpediteService, actions: NotificationServerActions) {
    mutableNotificationExpediteService.setNotificationServerActions(actions);
  }
}

/**
 * Pre-configured global provider for MutableNotificationExpediteService/NotificationExpediteService.
 */
@Global()
@Module({
  providers: provideMutableNotificationExpediteService(),
  exports: exportMutableNotificationExpediteService()
})
export class GlobalNotificationModule {}
