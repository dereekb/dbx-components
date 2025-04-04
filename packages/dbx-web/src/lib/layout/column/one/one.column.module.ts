import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxTwoColumnLayoutModule } from '../two';
import { DbxOneColumnComponent } from './one.column.component';

/**
 * @deprecated import DbxOneColumnComponent directly instead.
 */
@NgModule({
  imports: [DbxOneColumnComponent],
  exports: [DbxOneColumnComponent]
})
export class DbxOneColumnLayoutModule {}
