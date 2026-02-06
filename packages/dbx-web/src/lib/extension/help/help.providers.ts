import { type EnvironmentProviders, type Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxHelpWidgetService, DbxHelpWidgetServiceConfig } from './help.widget.service';
import { DbxHelpContextService } from './help.context.service';

/**
 * Factory for DbxHelpWidgetServiceConfig.
 */
export type DbxHelpWidgetServiceConfigFactory = (injector: Injector) => DbxHelpWidgetServiceConfig;

/**
 * Configuration for provideDbxHelpServices().
 */
export interface ProvideDbxHelpServicesConfig {
  /**
   * Initial help widget entries to register.
   */
  readonly dbxHelpWidgetServiceConfigFactory?: DbxHelpWidgetServiceConfigFactory;
}

/**
 * Creates EnvironmentProviders for the help context system.
 *
 * @param config Optional configuration
 * @returns EnvironmentProviders
 */
export function provideDbxHelpServices(config?: ProvideDbxHelpServicesConfig): EnvironmentProviders {
  const providers: Provider[] = [DbxHelpWidgetService, DbxHelpContextService];

  if (config?.dbxHelpWidgetServiceConfigFactory) {
    providers.push({
      provide: DbxHelpWidgetServiceConfig,
      useFactory: config.dbxHelpWidgetServiceConfigFactory
    });
  }

  return makeEnvironmentProviders(providers);
}
