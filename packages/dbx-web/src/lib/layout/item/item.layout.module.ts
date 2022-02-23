import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxIconItemComponent } from './item.icon.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbxIconItemComponent
  ],
  exports: [
    DbxIconItemComponent
  ]
})
export class DbxItemLayoutModule { }
