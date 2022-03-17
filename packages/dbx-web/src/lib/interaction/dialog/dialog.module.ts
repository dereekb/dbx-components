import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDialogContentDirective } from './dialog.content.component';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';
import { DbxActionDialogDirective } from './dialog.action.directive';

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
    DbxActionDialogDirective
  ],
  exports: [
    DbxDialogContentDirective,
    DbxActionDialogDirective
  ]
})
export class DbxDialogInteractionModule { }
