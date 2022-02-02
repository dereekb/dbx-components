import { NgModule } from '@angular/core';
import { DbxAnchorModule } from './anchor/anchor.module';
import { DbxAnchorListModule } from './anchorlist/anchorlist.module';
import { DbxNavbarModule } from './navbar/navbar.module';
import { DbxSidenavModule } from './sidenav/sidenav.module';

@NgModule({
  exports: [
    DbxAnchorModule,
    DbxAnchorListModule,
    DbxNavbarModule,
    DbxSidenavModule
  ]
})
export class DbxRouterLayoutModule { }
