import { type ModuleWithProviders, NgModule } from '@angular/core';
import { DbxRouterService } from '../../service/router.service';
import { DbxRouterTransitionService } from '../../service/router.transition.service';
import { DbxAngularRouterService } from './angular.router.service';

/**
 * NgModule that provides the Angular Router-based implementation of {@link DbxRouterService} and {@link DbxRouterTransitionService}.
 *
 * Use `forRoot()` to register the providers at the application root level.
 *
 * @example
 * ```ts
 * @NgModule({
 *   imports: [
 *     DbxCoreAngularRouterSegueModule.forRoot()
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @see {@link DbxAngularRouterService} for the underlying service implementation
 * @see {@link provideDbxUIRouterService} for the UIRouter alternative
 */
@NgModule({})
export class DbxCoreAngularRouterSegueModule {
  static forRoot(): ModuleWithProviders<DbxCoreAngularRouterSegueModule> {
    return {
      ngModule: DbxCoreAngularRouterSegueModule,
      providers: [
        DbxAngularRouterService,
        {
          provide: DbxRouterService,
          useExisting: DbxAngularRouterService
        },
        {
          provide: DbxRouterTransitionService,
          useExisting: DbxAngularRouterService
        }
      ]
    };
  }
}
