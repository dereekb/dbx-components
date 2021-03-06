import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxNavbarComponent } from './navbar.component';

@NgModule({
  imports: [CommonModule, MatTabsModule, MatButtonModule, MatIconModule, MatMenuModule, DbxRouterAnchorModule],
  declarations: [DbxNavbarComponent],
  exports: [DbxNavbarComponent]
})
export class DbxRouterNavbarModule {}
