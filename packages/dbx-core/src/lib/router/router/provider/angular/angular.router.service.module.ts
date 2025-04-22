import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxRouterService } from '../../service/router.service';
import { DbxRouterTransitionService } from '../../service/router.transition.service';
import { DbxAngularRouterService } from './angular.router.service';

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
