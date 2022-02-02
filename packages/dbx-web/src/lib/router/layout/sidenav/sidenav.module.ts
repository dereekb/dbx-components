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
import { DbxAnchorModule } from '../anchor/anchor.module';
import { DbxAnchorListModule } from '../anchorlist/anchorlist.module';

/**
 * Module for container-type components.
 */
@NgModule({
  imports: [
    CommonModule,
    DbxAnchorModule,
    DbxAnchorListModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    UIRouterModule
  ],
  declarations: [
    DbxSidenavComponent
    // AppSideNavBarTitleContentComponent,
    // AppSideNavBarItemComponent,
    // AppSideNavBarTitleComponent
  ],
  exports: [
    DbxSidenavComponent
    // AppSideNavBarTitleContentComponent,
    // AppSideNavBarTitleComponent,
    // AppSideNavBarTitleComponent
  ]
})
export class DbxSidenavModule { }
