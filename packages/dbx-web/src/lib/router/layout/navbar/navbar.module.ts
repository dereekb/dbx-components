import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxNavbarComponent } from './navbar.component';
import { DbxIconButtonModule } from '../../../button';
import { UIRouterModule } from '@uirouter/angular';

/**
 * @deprecated import DbxNavbarComponent directly
 */
@NgModule({
  imports: [DbxNavbarComponent],
  exports: [DbxNavbarComponent]
})
export class DbxRouterNavbarModule {}
