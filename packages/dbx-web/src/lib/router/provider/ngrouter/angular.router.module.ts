import { UIRouterModule } from '@uirouter/angular';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxAngularRouterSegueAnchorComponent } from './anchor.component';
import { DbNgxRouterWebProviderConfig } from '../router.provider.config';
import { DbNgxInjectedComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule,
    DbNgxInjectedComponentModule
  ],
  declarations: [DbNgxAngularRouterSegueAnchorComponent],
  exports: [DbNgxAngularRouterSegueAnchorComponent]
})
export class DbNgxWebAngularRouterModule {

  static forRoot(): ModuleWithProviders<DbNgxWebAngularRouterModule> {
    return {
      ngModule: DbNgxWebAngularRouterModule,
      providers: [
        {
          provide: DbNgxRouterWebProviderConfig,
          useValue: {
            anchorSegueRefComponent: {
              componentClass: DbNgxAngularRouterSegueAnchorComponent
            }
          } as DbNgxRouterWebProviderConfig
        }
      ]
    };
  }

}
