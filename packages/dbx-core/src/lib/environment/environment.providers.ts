import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAppEnvironment } from './environment';
import { DbxAppEnvironmentService } from './environment.service';

/**
 * Registers {@link DbxAppEnvironment} and {@link DbxAppEnvironmentService} as environment-level providers.
 *
 * @param environment - The concrete environment configuration to provide.
 * @returns The environment providers for the application environment.
 *
 * @example
 * ```typescript
 * // In app.config.ts:
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAppEnvironment({ production: true, staging: false }),
 *   ],
 * };
 * ```
 */
export function provideDbxAppEnvironment(environment: DbxAppEnvironment): EnvironmentProviders {
  const providers: Provider[] = [
    {
      provide: DbxAppEnvironment,
      useValue: environment
    },
    DbxAppEnvironmentService
  ];

  return makeEnvironmentProviders(providers);
}
