import { NgModule } from '@angular/core';
import { DbxErrorComponent } from './error.component';
import { DbxLoadingErrorDirective } from './error.loading.directive';
import { DbxActionErrorDirective } from './error.action.directive';
import { DbxErrorPopoverComponent } from './error.popover.component';
import { DbxErrorDetailsComponent } from './error.details.component';
import { DbxErrorWidgetViewComponent } from './error.widget.component';
import { DbxErrorDefaultErrorWidgetComponent } from './default.error.widget.component';
import { DbxErrorViewComponent } from './error.view.component';
import { DbxErrorSnackbarComponent } from './error.snackbar.component';
import { DbxActionSnackbarErrorDirective } from './error.snackbar.action.directive';

const importsAndExports = [
  //
  DbxErrorComponent,
  DbxLoadingErrorDirective,
  DbxActionErrorDirective,
  DbxActionSnackbarErrorDirective,
  DbxErrorViewComponent,
  DbxErrorSnackbarComponent,
  DbxErrorPopoverComponent,
  DbxErrorDetailsComponent,
  DbxErrorWidgetViewComponent,
  DbxErrorDefaultErrorWidgetComponent
];

/**
 * @deprecated all components are now standalone
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxReadableErrorModule {}
