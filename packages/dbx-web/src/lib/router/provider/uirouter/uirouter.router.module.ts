import { UIRouterModule } from '@uirouter/angular';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxUIRouterSegueAnchorComponent } from './anchor.component';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule,
    DbxInjectionComponentModule
  ],
  declarations: [DbxUIRouterSegueAnchorComponent],
  exports: [DbxUIRouterSegueAnchorComponent]
})
export class DbxWebUIRouterModule {

  static forRoot(): ModuleWithProviders<DbxWebUIRouterModule> {
    return {
      ngModule: DbxWebUIRouterModule,
      providers: [
        {
          provide: DbxRouterWebProviderConfig,
          useValue: {
            anchorSegueRefComponent: {
              componentClass: DbxUIRouterSegueAnchorComponent
            }
          } as DbxRouterWebProviderConfig
        }
      ]
    };
  }

}
