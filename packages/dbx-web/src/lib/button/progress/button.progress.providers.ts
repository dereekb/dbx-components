import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type DbxProgressButtonGlobalConfig, DBX_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';

/**
 * Registers a global configuration for progress buttons, allowing default styles and
 * behavior to be overridden application-wide by button ID.
 *
 * @param config - Array of targeted configurations to apply globally.
 * @returns Environment providers to include in your application bootstrap.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDbxProgressButtonGlobalConfig([
 *       { id: 'primary-save', buttonType: 'raised', buttonColor: 'primary' }
 *     ])
 *   ]
 * });
 * ```
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
