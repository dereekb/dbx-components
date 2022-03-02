import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxTwoColumnLayoutModule } from '../two';
import { DbNgxOneColumnComponent } from './one.column.component';

@NgModule({
  imports: [
    CommonModule,
    DbNgxTwoColumnLayoutModule
  ],
  declarations: [
    DbNgxOneColumnComponent
  ],
  exports: [
    DbNgxOneColumnComponent
  ],
})
export class DbNgxOneColumnLayoutModule { }
