import { NgModule } from '@angular/core';
import { DbxActionSnackbarDirective } from './action.snackbar.directive';
import { DbxActionSnackbarComponent } from './action.snackbar.component';

const importsAndExports = [DbxActionSnackbarComponent, DbxActionSnackbarDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionSnackbarModule {}
