import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxRouterTransitionService } from '../../service/router.transition.service';
import { DbNgxRouterService } from '../../service/router.service';
import { DbNgxUIRouterService } from './uirouter.router.service';

@NgModule({})
export class DbNgxCoreUIRouterSegueModule {

  static forRoot(): ModuleWithProviders<DbNgxCoreUIRouterSegueModule> {
    return {
      ngModule: DbNgxCoreUIRouterSegueModule,
      providers: [
        DbNgxUIRouterService,
        {
          provide: DbNgxRouterService,
          useExisting: DbNgxUIRouterService
        },
        {
          provide: DbNgxRouterTransitionService,
          useExisting: DbNgxUIRouterService
        }
      ]
    };
  }

}
