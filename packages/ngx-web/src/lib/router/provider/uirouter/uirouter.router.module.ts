import { UIRouterModule } from '@uirouter/angular';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbNgxUIRouterSegueAnchorComponent } from './anchor.component';
import { DbNgxRouterWebProviderConfig } from '../router.provider.config';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule
  ],
  declarations: [DbNgxUIRouterSegueAnchorComponent],
  exports: [DbNgxUIRouterSegueAnchorComponent]
})
export class DbNgxWebUIRouterModule {

  static forRoot(): ModuleWithProviders<DbNgxWebUIRouterModule> {
    return {
      ngModule: DbNgxWebUIRouterModule,
      providers: [
        {
          provide: DbNgxRouterWebProviderConfig,
          useValue: {
            anchorSegueRefComponent: {
              componentClass: DbNgxUIRouterSegueAnchorComponent
            }
          } as DbNgxRouterWebProviderConfig
        }
      ]
    };
  }

}
