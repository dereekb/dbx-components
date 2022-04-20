import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxAppAuthRoutes } from './auth.router';

@NgModule({
  imports: [],
  declarations: [],
  exports: []
})
export class DbxAppAuthRouterModule {

  static forRoot(dbxAppAuthRoutes: DbxAppAuthRoutes): ModuleWithProviders<DbxAppAuthRouterModule> {
    return {
      ngModule: DbxAppAuthRouterModule,
      providers: [{
        provide: DbxAppAuthRoutes,
        useValue: dbxAppAuthRoutes
      }]
    };
  }

}
