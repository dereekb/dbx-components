import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDialogContentComponent } from './dialog.content.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxDialogContentComponent
  ],
  exports: [
    DbxDialogContentComponent
  ]
})
export class DbxDialogLayoutModule { }
