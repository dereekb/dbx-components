import { MatIconModule } from '@angular/material/icon';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxReadableErrorComponent } from './error.component';
import { DbxLoadingErrorDirective } from './error.loading.directive';
import { DbxActionErrorDirective } from './error.action.directive';
import { MatButtonModule } from '@angular/material/button';
import { DbxErrorPopoverComponent } from './error.popover.component';
import { DbxErrorDetailsComponent } from './error.details.component';
import { DbxPopoverInteractionContentModule } from '../interaction/popover/popover.content.module';
import { DbxErrorWidgetViewComponent } from './error.widget.component';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxErrorDefaultErrorWidgetComponent } from './default.error.widget.component';
import { DbxTextModule } from '../layout/text/text.module';
import { DbxErrorViewComponent } from './error.view.component';
import { DbxErrorSnackbarComponent } from './error.snackbar.component';
import { DbxActionSnackbarErrorDirective } from './error.snackbar.action.directive';

const declarations = [
  //
  DbxReadableErrorComponent,
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

@NgModule({
  imports: [CommonModule, DbxTextModule, DbxInjectionComponentModule, DbxPopoverInteractionContentModule, MatButtonModule, MatIconModule],
  declarations,
  exports: declarations
})
export class DbxReadableErrorModule {}
