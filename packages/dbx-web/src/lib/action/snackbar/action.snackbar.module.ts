import { NgModule } from '@angular/core';
import { DbxActionSnackbarDirective } from './action.snackbar.directive';
import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DbxActionSnackbarUndoWorkDirective } from './action.snackbar.undo.directive';

const importsAndExports = [DbxActionSnackbarComponent, DbxActionSnackbarDirective, DbxActionSnackbarUndoWorkDirective];

/**
 * Bundles the snackbar component and directive for convenient import.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionSnackbarModule {}
