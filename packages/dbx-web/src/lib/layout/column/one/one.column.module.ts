import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxTwoColumnLayoutModule } from '../two';
import { DbxOneColumnComponent } from './one.column.component';

@NgModule({
  imports: [CommonModule, DbxTwoColumnLayoutModule],
  declarations: [DbxOneColumnComponent],
  exports: [DbxOneColumnComponent]
})
export class DbxOneColumnLayoutModule {}
