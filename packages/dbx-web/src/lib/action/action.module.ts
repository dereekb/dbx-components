import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DbNgxButtonModule } from '../button/button.module';
// import { DbNgxErrorModule } from '../error/error.module';
import { DbNgxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbNgxActionSnackbarComponent } from './action.snackbar.component';
import { DbNgxCoreActionModule } from '@dereekb/dbx-core';
import { DbNgxActionConfirmDirective } from './action.confirm.directive';
import { DbNgxPromptModule } from '../interaction/prompt/prompt.module';

@NgModule({
  imports: [
    CommonModule,
    DbNgxCoreActionModule,
    DbNgxButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
    DbNgxPromptModule,
  ],
  declarations: [
    DbNgxActionKeyTriggerDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionConfirmDirective,
  ],
  exports: [
    DbNgxCoreActionModule,
    DbNgxActionKeyTriggerDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionConfirmDirective,
  ]
})
export class DbNgxActionModule { }
