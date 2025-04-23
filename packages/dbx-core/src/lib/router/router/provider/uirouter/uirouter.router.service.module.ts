import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxRouterTransitionService } from '../../service/router.transition.service';
import { DbxRouterService } from '../../service/router.service';
import { DbxUIRouterService } from './uirouter.router.service';

/**
 * @deprecated use provideDbxUIRouterService() instead.
 */
@NgModule({})
export class DbxCoreUIRouterSegueModule {
  static forRoot(): ModuleWithProviders<DbxCoreUIRouterSegueModule> {
    return {
      ngModule: DbxCoreUIRouterSegueModule,
      providers: [
        DbxUIRouterService,
        {
          provide: DbxRouterService,
          useExisting: DbxUIRouterService
        },
        {
          provide: DbxRouterTransitionService,
          useExisting: DbxUIRouterService
        }
      ]
    };
  }
}
