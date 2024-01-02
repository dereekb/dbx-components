import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatLegacyTabsModule } from '@angular/material/legacy-tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxNavbarComponent } from './navbar.component';
import { DbxIconButtonModule } from '../../../button';

@NgModule({
  imports: [
    //
    CommonModule,
    DbxIconButtonModule,
    MatLegacyTabsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    DbxRouterAnchorModule
  ],
  declarations: [DbxNavbarComponent],
  exports: [DbxNavbarComponent]
})
export class DbxRouterNavbarModule {}
