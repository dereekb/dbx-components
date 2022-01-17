import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxRouterService } from '../../router.service';
import { DbNgxAngularRouterService } from './angular.router.service';

@NgModule({})
export class DbNgxCoreAngularRouterSegueModule {

  static forRoot(): ModuleWithProviders<DbNgxCoreAngularRouterSegueModule> {
    return {
      ngModule: DbNgxCoreAngularRouterSegueModule,
      providers: [
        {
          provide: DbNgxAngularRouterService,
          useValue: DbNgxRouterService
        }
      ]
    };
  }

}
