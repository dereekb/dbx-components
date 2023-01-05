import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxAnchorListComponent } from './anchorlist.component';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [CommonModule, DbxInjectionComponentModule, MatTabsModule, MatButtonModule, MatIconModule, MatListModule, MatMenuModule, DbxRouterAnchorModule],
  declarations: [DbxAnchorListComponent],
  exports: [DbxAnchorListComponent]
})
export class DbxRouterAnchorListModule {}
