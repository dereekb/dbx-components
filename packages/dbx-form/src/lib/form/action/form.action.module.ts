import { MatDialogModule } from '@angular/material/dialog';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxActionFormDirective } from './form.action.directive';

/**
 * @deprecated Import DbxActionFormDirective directly instead.
 */
@NgModule({
  imports: [DbxActionFormDirective],
  exports: [DbxActionFormDirective]
})
export class DbxFormActionModule {}
