import { NgModule } from '@angular/core';
import { DbxRouterAnchorModule } from './anchor/anchor.module';
import { DbxRouterSidenavModule } from './sidenav/sidenav.module';

@NgModule({
  exports: [DbxRouterAnchorModule, DbxRouterSidenavModule]
})
export class DbxRouterLayoutModule {}
