import { NgModule } from '@angular/core';
import { DbxAnchorModule } from './anchor/anchor.module';
import { DbxNavbarModule } from './navbar/navbar.module';
import { DbxSidenavModule } from './sidenav/sidenav.module';

@NgModule({
  exports: [
    DbxAnchorModule,
    DbxNavbarModule,
    DbxSidenavModule
  ]
})
export class DbxRouterLayoutModule { }
