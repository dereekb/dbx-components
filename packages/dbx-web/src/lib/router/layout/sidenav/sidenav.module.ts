import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatToolbarModule } from '@angular/material/legacy-toolbar';
import { MatButtonModule } from '@angular/material/button';
import { UIRouterModule } from '@uirouter/angular';
import { DbxSidenavComponent } from './sidenav.component';
import { MatSidenavModule } from '@angular/material/legacy-sidenav';
import { MatLegacyListModule } from '@angular/material/legacy-list';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { DbxRouterAnchorListModule } from '../anchorlist/anchorlist.module';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { DbxSidenavPageComponent } from './sidenav.page.component';
import { DbxBarLayoutModule } from '../../../layout/bar/bar.layout.module';
import { DbxButtonModule } from '../../../button/button.module';
import { DbxContentLayoutModule } from './../../../layout/content/content.layout.module';
import { DbxSidenavButtonComponent } from './sidenav.button.component';
import { DbxIfSidenavDisplayModeDirective } from './sidenav.ifdisplaymode.directive';

const declarations = [DbxIfSidenavDisplayModeDirective, DbxSidenavComponent, DbxSidenavButtonComponent, DbxSidenavPagebarComponent, DbxSidenavPageComponent];

@NgModule({
  imports: [CommonModule, DbxBarLayoutModule, DbxRouterAnchorModule, DbxRouterAnchorListModule, DbxButtonModule, DbxContentLayoutModule, MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatLegacyListModule, MatDividerModule, UIRouterModule],
  declarations,
  exports: declarations
})
export class DbxRouterSidenavModule {}
