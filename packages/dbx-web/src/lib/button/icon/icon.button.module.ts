import { NgModule } from '@angular/core';
import { DbxIconButtonComponent } from './icon.button.component';

/**
 * @deprecated Use `dbx-button` instead of `dbx-icon-button`. See {@link DbxIconButtonComponent} for migration guidance.
 */
@NgModule({
  imports: [DbxIconButtonComponent],
  exports: [DbxIconButtonComponent]
})
export class DbxIconButtonModule {}
