import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxRouterService, DbxRouterTransitionService } from '../../service';
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
