import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxRouterService, DbNgxRouterTransitionService } from '../../service';
import { DbNgxAngularRouterService } from './angular.router.service';

@NgModule({})
export class DbNgxCoreAngularRouterSegueModule {

  static forRoot(): ModuleWithProviders<DbNgxCoreAngularRouterSegueModule> {
    return {
      ngModule: DbNgxCoreAngularRouterSegueModule,
      providers: [
        DbNgxAngularRouterService,
        {
          provide: DbNgxRouterService,
          useExisting: DbNgxAngularRouterService
        },
        {
          provide: DbNgxRouterTransitionService,
          useExisting: DbNgxAngularRouterService
        }
      ]
    };
  }

}
