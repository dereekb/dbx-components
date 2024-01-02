import { MatLegacyListModule } from '@angular/material/legacy-list';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatLegacyTabsModule } from '@angular/material/legacy-tabs';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxAnchorListComponent } from './anchorlist.component';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [CommonModule, DbxInjectionComponentModule, MatLegacyTabsModule, MatButtonModule, MatIconModule, MatLegacyListModule, MatMenuModule, DbxRouterAnchorModule],
  declarations: [DbxAnchorListComponent],
  exports: [DbxAnchorListComponent]
})
export class DbxRouterAnchorListModule {}
