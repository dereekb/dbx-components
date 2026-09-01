import { type InjectionToken, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { AppFormSpaceTypeConfigService, appFormSpaceTypeConfigService, type FormSpaceTypeConfig, formSpaceTypeConfigRecord } from '@dereekb/firebase';
import { BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN, type BaseFormSpaceServerActionsContext, FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN, formSpaceServerActions, FormSpaceServerActions, type FormSpaceServerActionsContext } from './formspace.action.server';

/**
 * NestJS injection token for the app's `FormSpaceTypeConfig[]` registry.
 *
 * Apps bind this token via {@link appFormSpaceModuleMetadata} by passing `formSpaceTypeConfigs`.
 */
export const FORM_SPACE_TYPE_CONFIGS_TOKEN: InjectionToken = 'FORM_SPACE_TYPE_CONFIGS';

// MARK: Provider Factories
/**
 * Factory that builds the app's {@link AppFormSpaceTypeConfigService} from its registered configs.
 *
 * @param formSpaceTypeConfigs - The app's form space type registry.
 * @returns The service.
 */
export function appFormSpaceTypeConfigServiceFactory(formSpaceTypeConfigs: FormSpaceTypeConfig[]): AppFormSpaceTypeConfigService {
  return appFormSpaceTypeConfigService(formSpaceTypeConfigRecord(formSpaceTypeConfigs));
}

/**
 * Factory that assembles the full {@link FormSpaceServerActionsContext}.
 *
 * @param context - The base context providing Firebase infrastructure and collections.
 * @param appFormSpaceTypeConfigServiceInstance - The app's form space type registry service.
 * @returns The fully assembled context.
 */
export function formSpaceServerActionsContextFactory(context: BaseFormSpaceServerActionsContext, appFormSpaceTypeConfigServiceInstance: AppFormSpaceTypeConfigService): FormSpaceServerActionsContext {
  return { ...context, appFormSpaceTypeConfigService: appFormSpaceTypeConfigServiceInstance };
}

/**
 * Factory that creates a {@link FormSpaceServerActions} instance from the assembled context.
 *
 * @param context - The fully assembled form space server actions context.
 * @returns The server actions.
 */
export function formSpaceServerActionsFactory(context: FormSpaceServerActionsContext) {
  return formSpaceServerActions(context);
}

// MARK: App FormSpace Model Module
export interface ProvideAppFormSpaceMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The AppFormSpaceModule requires the following dependencies in order to initialize properly:
   * - BaseFormSpaceServerActionsContext (BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN)
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * The app's {@link FormSpaceType} registry. Bound to {@link FORM_SPACE_TYPE_CONFIGS_TOKEN}.
   */
  readonly formSpaceTypeConfigs: FormSpaceTypeConfig[];
}

/**
 * Convenience function used to generate ModuleMetadata for an app's FormSpaceModule.
 *
 * By default this module exports:
 * - FormSpaceServerActionsContext (FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN)
 * - FormSpaceServerActions
 * - AppFormSpaceTypeConfigService
 *
 * @param config - The module configuration.
 * @returns The assembled {@link ModuleMetadata} for the form space module.
 */
export function appFormSpaceModuleMetadata(config: ProvideAppFormSpaceMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers, formSpaceTypeConfigs } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN, FormSpaceServerActions, AppFormSpaceTypeConfigService, ...(exports ?? [])],
    providers: [
      {
        provide: FORM_SPACE_TYPE_CONFIGS_TOKEN,
        useValue: formSpaceTypeConfigs
      },
      {
        provide: AppFormSpaceTypeConfigService,
        useFactory: appFormSpaceTypeConfigServiceFactory,
        inject: [FORM_SPACE_TYPE_CONFIGS_TOKEN]
      },
      {
        provide: FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN,
        useFactory: formSpaceServerActionsContextFactory,
        inject: [BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN, AppFormSpaceTypeConfigService]
      },
      {
        provide: FormSpaceServerActions,
        useFactory: formSpaceServerActionsFactory,
        inject: [FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN]
      },
      ...(providers ?? [])
    ]
  };
}
