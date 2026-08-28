import { type InjectionToken, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { AppCalendarTypeConfigService, appCalendarTypeConfigService, type CalendarTypeConfig, calendarTypeConfigRecord } from '@dereekb/firebase';
import { BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN, type BaseCalendarServerActionsContext, CALENDAR_SERVER_ACTION_CONTEXT_TOKEN, calendarServerActions, CalendarServerActions, type CalendarServerActionsContext } from './calendar.action.server';

/**
 * NestJS injection token for the app's `CalendarTypeConfig[]` registry.
 *
 * Apps bind this token via {@link appCalendarModuleMetadata} by passing `calendarTypeConfigs`.
 */
export const CALENDAR_TYPE_CONFIGS_TOKEN: InjectionToken = 'CALENDAR_TYPE_CONFIGS';

/**
 * NestJS injection token for the domain every generated event UID is suffixed with.
 */
export const CALENDAR_ICS_DOMAIN_TOKEN: InjectionToken = 'CALENDAR_ICS_DOMAIN';

// MARK: Provider Factories
/**
 * Factory that builds the app's {@link AppCalendarTypeConfigService} from its registered configs.
 *
 * @param calendarTypeConfigs - The app's calendar type registry.
 * @returns The service.
 */
export function appCalendarTypeConfigServiceFactory(calendarTypeConfigs: CalendarTypeConfig[]): AppCalendarTypeConfigService {
  return appCalendarTypeConfigService(calendarTypeConfigRecord(calendarTypeConfigs));
}

/**
 * Factory that assembles the full {@link CalendarServerActionsContext}.
 *
 * @param context - The base context providing Firebase infrastructure and collections.
 * @param appCalendarTypeConfigServiceInstance - The app's calendar type registry service.
 * @returns The fully assembled context.
 */
export function calendarServerActionsContextFactory(context: BaseCalendarServerActionsContext, appCalendarTypeConfigServiceInstance: AppCalendarTypeConfigService): CalendarServerActionsContext {
  return { ...context, appCalendarTypeConfigService: appCalendarTypeConfigServiceInstance };
}

/**
 * Factory that creates a {@link CalendarServerActions} instance from the assembled context.
 *
 * @param context - The fully assembled calendar server actions context.
 * @returns The server actions.
 */
export function calendarServerActionsFactory(context: CalendarServerActionsContext) {
  return calendarServerActions(context);
}

// MARK: App Calendar Model Module
export interface ProvideAppCalendarMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The AppCalendarModule requires the following dependencies in order to initialize properly:
   * - BaseCalendarServerActionsContext (BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN)
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * The app's {@link CalendarType} registry. Bound to {@link CALENDAR_TYPE_CONFIGS_TOKEN}.
   */
  readonly calendarTypeConfigs: CalendarTypeConfig[];
  /**
   * The domain every generated event UID is suffixed with. I.E. "example.com".
   *
   * REQUIRED: the UID factory deliberately has no random fallback, since a UID that changes between
   * publishes makes every client create a duplicate event rather than update the one it holds.
   */
  readonly icsDomain: string;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's CalendarModule.
 *
 * By default this module exports:
 * - CalendarServerActionsContext (CALENDAR_SERVER_ACTION_CONTEXT_TOKEN)
 * - CalendarServerActions
 * - AppCalendarTypeConfigService
 * - CALENDAR_ICS_DOMAIN_TOKEN
 *
 * @param config - The module configuration.
 * @returns The assembled {@link ModuleMetadata} for the calendar module.
 */
export function appCalendarModuleMetadata(config: ProvideAppCalendarMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers, calendarTypeConfigs, icsDomain } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [CALENDAR_SERVER_ACTION_CONTEXT_TOKEN, CalendarServerActions, AppCalendarTypeConfigService, CALENDAR_ICS_DOMAIN_TOKEN, ...(exports ?? [])],
    providers: [
      {
        provide: CALENDAR_TYPE_CONFIGS_TOKEN,
        useValue: calendarTypeConfigs
      },
      {
        provide: CALENDAR_ICS_DOMAIN_TOKEN,
        useValue: icsDomain
      },
      {
        provide: AppCalendarTypeConfigService,
        useFactory: appCalendarTypeConfigServiceFactory,
        inject: [CALENDAR_TYPE_CONFIGS_TOKEN]
      },
      {
        provide: CALENDAR_SERVER_ACTION_CONTEXT_TOKEN,
        useFactory: calendarServerActionsContextFactory,
        inject: [BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN, AppCalendarTypeConfigService]
      },
      {
        provide: CalendarServerActions,
        useFactory: calendarServerActionsFactory,
        inject: [CALENDAR_SERVER_ACTION_CONTEXT_TOKEN]
      },
      ...(providers ?? [])
    ]
  };
}
