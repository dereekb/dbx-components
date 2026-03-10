import { NgModule } from '@angular/core';
import { DbxRouterAnchorModule } from './anchor/anchor.module';
import { DbxRouterSidenavModule } from './sidenav/sidenav.module';

/**
 * Convenience NgModule that re-exports {@link DbxRouterAnchorModule} and {@link DbxRouterSidenavModule}.
 */
@NgModule({
  exports: [DbxRouterAnchorModule, DbxRouterSidenavModule]
})
export class DbxRouterLayoutModule {}
