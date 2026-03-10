import { DbxRouterService } from '../../service/router.service';
import { DbxRouterTransitionService } from '../../service/router.transition.service';
import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxUIRouterService } from './uirouter.router.service';

/**
 * Creates Angular environment providers that register {@link DbxUIRouterService} as the implementation
 * for both {@link DbxRouterService} and {@link DbxRouterTransitionService}.
 *
 * Use this function in the application's `bootstrapApplication` or `provideRouter` configuration
 * when using UIRouter as the routing framework.
 *
 * @returns Angular `EnvironmentProviders` for the UIRouter-based router service.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideDbxUIRouterService()
 *   ]
 * });
 * ```
 *
 * @see {@link DbxUIRouterService}
 * @see {@link DbxCoreAngularRouterSegueModule} for the Angular Router alternative
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
