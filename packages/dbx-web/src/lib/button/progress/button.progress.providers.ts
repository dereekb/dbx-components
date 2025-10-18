import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type DbxProgressButtonGlobalConfig, DBX_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';

/**
 * Provides the global configuration for DbxProgressButtonComponent.
 *
 * @param config
 * @returns
 */
export function provideDbxProgressButtonGlobalConfig(config: DbxProgressButtonGlobalConfig): EnvironmentProviders {
  const providers: Provider[] = [
    {
      provide: DBX_PROGRESS_BUTTON_GLOBAL_CONFIG,
      useValue: config
    }
  ];

  return makeEnvironmentProviders(providers);
}
