import { NgModule } from '@angular/core';
import { DbxSidenavComponent } from './sidenav.component';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { DbxSidenavPageComponent } from './sidenav.page.component';
import { DbxSidenavButtonComponent } from './sidenav.button.component';
import { DbxIfSidenavDisplayModeDirective } from './sidenav.ifdisplaymode.directive';

const importsAndExports = [DbxIfSidenavDisplayModeDirective, DbxSidenavComponent, DbxSidenavButtonComponent, DbxSidenavPagebarComponent, DbxSidenavPageComponent];

/**
 * NgModule that re-exports all standalone sidenav-related components and directives for backward compatibility.
 *
 * Prefer importing individual standalone components directly in new code.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxRouterSidenavModule {}
