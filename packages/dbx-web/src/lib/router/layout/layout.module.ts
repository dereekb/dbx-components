import { NgModule } from '@angular/core';
import { DbxRouterAnchorModule } from './anchor/anchor.module';
import { DbxRouterAnchorListModule } from './anchorlist/anchorlist.module';
import { DbxRouterListModule } from './list/list.module';
import { DbxRouterNavbarModule } from './navbar/navbar.module';
import { DbxRouterSidenavModule } from './sidenav/sidenav.module';

@NgModule({
  exports: [DbxRouterAnchorModule, DbxRouterAnchorListModule, DbxRouterListModule, DbxRouterNavbarModule, DbxRouterSidenavModule]
})
export class DbxRouterLayoutModule {}
