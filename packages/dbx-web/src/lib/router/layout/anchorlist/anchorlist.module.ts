import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { DbxAnchorModule } from '../anchor/anchor.module';
import { MatMenuModule } from '@angular/material/menu';
import { DbxAnchorListComponent } from './anchorlist.component';


@NgModule({
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    DbxAnchorModule,
  ],
  declarations: [
    DbxAnchorListComponent
  ],
  exports: [
    DbxAnchorListComponent
  ]
})
export class DbxAnchorListModule { }
