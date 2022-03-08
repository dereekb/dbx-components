import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxButtonModule } from '../../button';
import { DbxPromptModule } from '../../interaction';
import { DbxReadableErrorModule } from '../../error';
import { DbxActionSnackbarDirective } from './action.snackbar.directive';
import { DbxActionSnackbarComponent } from './action.snackbar.component';

@NgModule({
  imports: [
    CommonModule,
    DbxCoreActionModule,
    DbxPromptModule,
    DbxButtonModule,
    DbxReadableErrorModule
  ],
  declarations: [
    DbxActionSnackbarComponent,
    DbxActionSnackbarDirective
  ],
  exports: [
    DbxActionSnackbarComponent,
    DbxActionSnackbarDirective
  ]
})
export class DbxActionSnackbarModule { }
