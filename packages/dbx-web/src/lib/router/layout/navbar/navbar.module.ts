import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/legacy-tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatLegacyMenuModule } from '@angular/material/legacy-menu';
import { DbxNavbarComponent } from './navbar.component';
import { DbxIconButtonModule } from '../../../button';

@NgModule({
  imports: [
    //
    CommonModule,
    DbxIconButtonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatLegacyMenuModule,
    DbxRouterAnchorModule
  ],
  declarations: [DbxNavbarComponent],
  exports: [DbxNavbarComponent]
})
export class DbxRouterNavbarModule {}
