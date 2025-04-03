import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { DbxAnchorListComponent } from './anchorlist.component';

/**
 * @deprecated import standalone DbxAnchorListComponent directly
 */
@NgModule({
  imports: [DbxAnchorListComponent],
  exports: [DbxAnchorListComponent]
})
export class DbxRouterAnchorListModule {}
