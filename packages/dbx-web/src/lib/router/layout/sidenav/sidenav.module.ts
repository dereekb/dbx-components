import { NgModule } from '@angular/core';
import { DbxSidenavComponent } from './sidenav.component';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { DbxSidenavPageComponent } from './sidenav.page.component';
import { DbxSidenavButtonComponent } from './sidenav.button.component';
import { DbxIfSidenavDisplayModeDirective } from './sidenav.ifdisplaymode.directive';

const importsAndExports = [DbxIfSidenavDisplayModeDirective, DbxSidenavComponent, DbxSidenavButtonComponent, DbxSidenavPagebarComponent, DbxSidenavPageComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxRouterSidenavModule {}
