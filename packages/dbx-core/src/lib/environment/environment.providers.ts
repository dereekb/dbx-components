import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAppEnviroment } from './environment';
import { DbxAppEnviromentService } from './environment.service';

/**
 * Provides the DbxAppEnviromentService and DbxAppEnviroment.
 *
 * @param environment
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
