import { UIRouterModule } from '@uirouter/angular';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxAngularRouterSegueAnchorComponent } from './anchor.component';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [CommonModule, UIRouterModule, DbxInjectionComponentModule],
  declarations: [DbxAngularRouterSegueAnchorComponent],
  exports: [DbxAngularRouterSegueAnchorComponent]
})
export class DbxWebAngularRouterModule {
  static forRoot(): ModuleWithProviders<DbxWebAngularRouterModule> {
    return {
      ngModule: DbxWebAngularRouterModule,
      providers: [
        {
          provide: DbxRouterWebProviderConfig,
          useValue: {
            anchorSegueRefComponent: {
              componentClass: DbxAngularRouterSegueAnchorComponent
            }
          } as DbxRouterWebProviderConfig
        }
      ]
    };
  }
}
