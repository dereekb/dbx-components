import { Global, Inject, Module, type ModuleMetadata } from '@nestjs/common';
import { NOTIFICATION_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, notificationInitServerActions, NotificationInitServerActions, type NotificationInitServerActionsContextConfig } from './notification.action.server.init';
import { BASE_NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, type BaseNotificationServerActionsContext, NOTIFICATION_SERVER_ACTION_CONTEXT_TOKEN, notificationServerActions, NotificationServerActions, type NotificationServerActionsContext } from './notification.action.server';
import { NotificationTemplateService } from './notification.config.service';
import { type Maybe } from '@dereekb/util';
import { ConfigModule } from '@nestjs/config';
import { NotificationSendService } from './notification.send.service';
import { NotificationTaskService } from './notification.task.service';
import { exportMutableNotificationExpediteService, MutableNotificationExpediteService, NotificationExpediteService, provideMutableNotificationExpediteService } from './notification.expedite.service';

// MARK: Provider Factories
/**
 * Configuration for assembling a {@link NotificationServerActionsContext}.
 */
export interface NotificationServerActionsContextFactoryConfig {
  readonly context: BaseNotificationServerActionsContext;
  readonly notificationTemplateService: NotificationTemplateService;
  readonly notificationSendService: NotificationSendService;
  readonly notificationTaskService: NotificationTaskService;
  readonly notificationsExpediteService: NotificationExpediteService;
}

/**
 * Positional argument tuple matching the NestJS inject order for {@link notificationServerActionsContextFactory}.
 */
export type NotificationServerActionsContextFactoryArgs = [BaseNotificationServerActionsContext, NotificationTemplateService, NotificationSendService, NotificationTaskService, NotificationExpediteService];

/**
 * Converts positional NestJS inject arguments into a {@link NotificationServerActionsContextFactoryConfig}.
 *
 * @param args - the positional argument tuple from NestJS injection
 * @returns the assembled factory configuration object
 */
export function notificationServerActionsContextFactoryConfigFromArgs(args: NotificationServerActionsContextFactoryArgs): NotificationServerActionsContextFactoryConfig {
  const [context, notificationTemplateService, notificationSendService, notificationTaskService, notificationsExpediteService] = args;
  return { context, notificationTemplateService, notificationSendService, notificationTaskService, notificationsExpediteService };
}

/**
 * Factory that assembles the full {@link NotificationServerActionsContext} by combining
 * the base context with the template, send, task, and expedite services.
 *
 * @param config - the factory configuration with base context and all required services
 * @returns the fully assembled {@link NotificationServerActionsContext}
 */
export function notificationServerActionsContextFactory(config: NotificationServerActionsContextFactoryConfig) {
  const { context, notificationTemplateService, notificationSendService, notificationTaskService, notificationsExpediteService } = config;
  return { ...context, notificationTemplateService, notificationSendService, notificationTaskService, notificationsExpediteService };
}

/**
 * Factory that creates a {@link NotificationServerActions} instance from the assembled context.
 *
 * @param context - the fully assembled notification server actions context
 * @param _mutableNotificationExpediteService - injected for DI wiring; not used directly
 * @returns a new {@link NotificationServerActions} instance
 */
export function notificationServerActionsFactory(context: NotificationServerActionsContext, _mutableNotificationExpediteService: MutableNotificationExpediteService) {
  return notificationServerActions(context);
}

/**
 * Factory that creates a {@link NotificationInitServerActions} instance by merging the
 * server actions context with the init-specific configuration.
 *
 * @param context - the fully assembled notification server actions context
 * @param notificationInitServerActionsContextConfig - additional configuration specific to initialization actions
 * @returns a new {@link NotificationInitServerActions} instance
 */
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
 * @param config - the module configuration including optional dependency module, imports, exports, and providers
 * @returns the assembled {@link ModuleMetadata} for the notification module
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
        useFactory: (...args: NotificationServerActionsContextFactoryArgs) => notificationServerActionsContextFactory(notificationServerActionsContextFactoryConfigFromArgs(args)),
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
  constructor(@Inject(MutableNotificationExpediteService) mutableNotificationExpediteService: MutableNotificationExpediteService, @Inject(NotificationServerActions) actions: NotificationServerActions) {
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
