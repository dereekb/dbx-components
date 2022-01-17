import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxRouterService } from '../../router.service';
import { DbNgxUIRouterService } from './uirouter.router.service';

@NgModule({})
export class DbNgxCoreUIRouterSegueModule {

  static forRoot(): ModuleWithProviders<DbNgxCoreUIRouterSegueModule> {
    return {
      ngModule: DbNgxCoreUIRouterSegueModule,
      providers: [
        {
          provide: DbNgxUIRouterService,
          useValue: DbNgxRouterService
        }
      ]
    };
  }

}
