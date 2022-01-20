import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxDialogContentComponent } from './dialog.content.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxDialogContentComponent
  ],
  exports: [
    DbNgxDialogContentComponent
  ]
})
export class DbNgxDialogLayoutModule { }
