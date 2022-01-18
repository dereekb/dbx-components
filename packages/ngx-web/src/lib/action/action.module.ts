import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DbNgxButtonModule } from '../button/button.module';
// import { DbNgxErrorModule } from '../error/error.module';
// import { DbNgxPromptModule } from '../responsive/prompt/prompt.module';
import { DbNgxActionTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbNgxActionTransitionSafetyDirective } from './transition.safety.directive';
import { DbNgxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbNgxActionSuccessComponent } from './success.component';
import { DbNgxActionWorkingComponent } from './working.component';
import { DbNgxActionSnackbarComponent } from './action.snackbar.component';
import { DbNgxCoreActionModule } from '@dereekb/ngx-core';
import { DbNgxActionConfirmDirective } from './action.confirm.directive';

@NgModule({
  imports: [
    CommonModule,
    DbNgxCoreActionModule,
    DbNgxButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
  ],
  declarations: [
    DbNgxActionKeyTriggerDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionConfirmDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionWorkingComponent,
    DbNgxActionTransitionSafetyDirective,
    DbNgxActionTransitionSafetyDialogComponent
  ],
  exports: [
    DbNgxCoreActionModule,
    DbNgxActionKeyTriggerDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionConfirmDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionWorkingComponent,
    DbNgxActionTransitionSafetyDirective,
  ]
})
export class DbNgxActionModule { }
