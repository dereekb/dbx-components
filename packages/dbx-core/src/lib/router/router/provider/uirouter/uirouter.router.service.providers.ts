import { DbxRouterService, DbxRouterTransitionService } from '../../service';
import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { DbxUIRouterService } from './uirouter.router.service';

/**
 * Provides a DbxUIRouterService and configures it to provide for DbxRouterService and DbxRouterTransitionService.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxUIRouterService(): EnvironmentProviders {
  const providers: Provider[] = [
    DbxUIRouterService,
    {
      provide: DbxRouterService,
      useExisting: DbxUIRouterService
    },
    {
      provide: DbxRouterTransitionService,
      useExisting: DbxUIRouterService
    }
  ];

  return makeEnvironmentProviders(providers);
}
