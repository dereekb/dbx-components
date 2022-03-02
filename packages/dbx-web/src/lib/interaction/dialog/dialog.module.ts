import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDialogContentDirective } from './dialog.content.component';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    DbxStyleLayoutModule
  ],
  declarations: [
    DbxDialogContentDirective,
  ],
  exports: [
    DbxDialogContentDirective
  ]
})
export class DbxDialogInteractionModule { }
