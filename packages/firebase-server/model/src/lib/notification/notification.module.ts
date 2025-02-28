import { type ModuleMetadata } from '@nestjs/common';
import { NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, notificationInitServerActions, NotificationInitServerActions, type NotificationInitServerActionsContextConfig } from './notification.action.init.server';
import { BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, type BaseNotificationServerActionsContext, NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, notificationServerActions, NotificationServerActions, type NotificationServerActionsContext } from './notification.action.server';
import { NotificationTemplateService } from './notification.config.service';
import { type Maybe } from '@dereekb/util';
import { ConfigModule } from '@nestjs/config';
import { NotificationSendService } from './notification.send.service';

// MARK: Provider Factories
export function notificationServerActionsContextFactory(context: BaseNotificationServerActionsContext, notificationTemplateService: NotificationTemplateService, notificationSendService: NotificationSendService) {
  return { ...context, notificationTemplateService, notificationSendService };
}

export function notificationServerActionsFactory(context: NotificationServerActionsContext) {
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
   * - NotificationSendService
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
    exports: [NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationTemplateService, NotificationServerActions, NotificationInitServerActions, ...(exports ?? [])],
    providers: [
      {
        provide: NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN,
        useFactory: notificationServerActionsContextFactory,
        inject: [BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, NotificationTemplateService, NotificationSendService]
      },
      {
        provide: NotificationTemplateService,
        useClass: NotificationTemplateService
      },
      {
        provide: NotificationServerActions,
        useFactory: notificationServerActionsFactory,
        inject: [NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN]
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
