import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DbxButtonModule } from '../button/button.module';
// import { DbxErrorModule } from '../error/error.module';
import { DbxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective } from './action.confirm.directive';
import { DbxPromptModule } from '../interaction/prompt/prompt.module';

@NgModule({
  imports: [
    CommonModule,
    DbxCoreActionModule,
    DbxButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
    DbxPromptModule,
  ],
  declarations: [
    DbxActionKeyTriggerDirective,
    DbxActionSnackbarComponent,
    DbxActionConfirmDirective,
  ],
  exports: [
    DbxCoreActionModule,
    DbxActionKeyTriggerDirective,
    DbxActionSnackbarComponent,
    DbxActionConfirmDirective,
  ]
})
export class DbxActionModule { }
