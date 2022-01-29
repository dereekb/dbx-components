import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxIconItemComponent } from './item.icon.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule
  ],
  declarations: [
    DbNgxIconItemComponent
  ],
  exports: [
    DbNgxIconItemComponent
  ]
})
export class DbNgxItemLayoutModule { }
