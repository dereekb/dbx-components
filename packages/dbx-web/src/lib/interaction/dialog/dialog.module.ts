import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDialogContentComponent } from './dialog.content.component';
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
    DbxDialogContentComponent,
  ],
  exports: [
    DbxDialogContentComponent
  ]
})
export class DbxDialogInteractionModule { }
