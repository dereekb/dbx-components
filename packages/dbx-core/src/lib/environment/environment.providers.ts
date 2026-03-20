import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAppEnviroment } from './environment';
import { DbxAppEnviromentService } from './environment.service';

/**
 * Registers {@link DbxAppEnviroment} and {@link DbxAppEnviromentService} as environment-level providers.
 *
 * @param environment - The concrete environment configuration to provide.
 * @returns The environment providers for the application environment.
 *
 * @example
 * ```typescript
 * // In app.config.ts:
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAppEnviroment({ production: true, staging: false }),
 *   ],
 * };
 * ```
 */
export function provideDbxAppEnviroment(environment: DbxAppEnviroment): EnvironmentProviders {
  const providers: Provider[] = [
    {
      provide: DbxAppEnviroment,
      useValue: environment
    },
    DbxAppEnviromentService
  ];

  return makeEnvironmentProviders(providers);
}
