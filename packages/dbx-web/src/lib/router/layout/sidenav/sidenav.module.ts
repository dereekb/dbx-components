import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { UIRouterModule } from '@uirouter/angular';
import { DbxSidenavComponent } from './sidenav.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { DbxRouterAnchorListModule } from '../anchorlist/anchorlist.module';
import { DbxSidenavPagebarComponent } from './sidenav.pagebar.component';
import { DbxSidenavPageComponent } from './sidenav.page.component';
import { DbxBarLayoutModule } from '../../../layout/bar/bar.layout.module';
import { DbxButtonModule } from '../../../button/button.module';
import { DbxContentLayoutModule } from './../../../layout/content/content.layout.module';
import { DbxSidenavButtonComponent } from './sidenav.button.component';

@NgModule({
  imports: [
    CommonModule,
    DbxBarLayoutModule,
    DbxRouterAnchorModule,
    DbxRouterAnchorListModule,
    DbxButtonModule,
    DbxContentLayoutModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    UIRouterModule
  ],
  declarations: [
    DbxSidenavComponent,
    DbxSidenavButtonComponent,
    DbxSidenavPagebarComponent,
    DbxSidenavPageComponent
  ],
  exports: [
    DbxSidenavComponent,
    DbxSidenavButtonComponent,
    DbxSidenavPagebarComponent,
    DbxSidenavPageComponent
  ]
})
export class DbxRouterSidenavModule { }
