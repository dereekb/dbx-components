import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { DbNgxButtonModule } from '../button/button.module';
import { AppErrorModule } from '../error/error.module';
import { AppPromptModule } from '../responsive/prompt/prompt.module';
import { DbNgxActionComponent } from './action.component';
import { DbNgxActionContextDirective } from './action.directive';
import { DbNgxActionAutoTriggerDirective } from './autotrigger.directive';
import { DbNgxActionButtonTriggerDirective, DbNgxActionButtonDirective } from './action.button.directive';
import { DbNgxActionConfirmDirective } from '../../../../ngx-web/src/lib/action/action.confirm.directive';
import { DbNgxActionHandlerDirective } from './handler.directive';

import { DbNgxActionSuccessDirective } from '../../../../ngx-core/src/lib/action/success.directive';
import { DbNgxActionTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbNgxActionTransitionSafetyDirective } from './transition.safety.directive';
import { DbNgxActionValueDirective } from './value.directive';
import { DbNgxActionKeyTriggerDirective } from './key.trigger.directive';
import { DbNgxActionSuccessComponent } from './success.component';
import { DbNgxActionWorkingComponent } from './working.component';
import { DbNgxActionFromMapDirective } from './action.map.key.directive';
import { DbNgxActionMapSourceDirective } from './action.map.source.directive';
import { DbNgxActionContextMapDirective } from './action.map.directive';
import { DbNgxActionMapWorkingDisableDirective } from './action.map.working.disable.directive';
import { DbNgxActionSourceDirective } from './action.source.directive';
import { DbNgxActionSnackbarComponent } from '../../../../ngx-web/src/lib/action/action.snackbar.component';
import { DbNgxActionDisabledDirective } from './action.disabled.directive';
import { DbNgxActionAutoModifyDirective } from './automodify.directive';
import { DbNgxActionAutoTriggerValueDirective } from './autotrigger.value.directive';
import { DbNgxActionDisabledUntilModifiedDirective } from './action.disabled.modified.directive';
import { DbNgxActionContextLoggerDirective } from './action.logger.directive';

@NgModule({
  imports: [
    CommonModule,
    AppPromptModule,
    AppErrorModule,
    DbNgxButtonModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonModule,
  ],
  declarations: [
    DbNgxActionComponent,
    DbNgxActionContextDirective,
    DbNgxActionContextMapDirective,
    DbNgxActionFromMapDirective,
    DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective,
    DbNgxActionSourceDirective,
    DbNgxActionHandlerDirective,
    DbNgxActionSuccessDirective,
    DbNgxActionKeyTriggerDirective,
    DbNgxActionDisabledDirective,
    DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
    DbNgxActionSnackbarDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionAutoTriggerDirective,
    DbNgxActionAutoTriggerValueDirective,
    DbNgxActionAutoModifyDirective,
    DbNgxActionValueDirective,
    DbNgxActionConfirmDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionWorkingComponent,
    DbNgxActionTransitionSafetyDirective,
    DbNgxActionTransitionSafetyDialogComponent,
    DbNgxActionContextLoggerDirective
  ],
  exports: [
    DbNgxActionComponent,
    DbNgxActionContextDirective,
    DbNgxActionContextMapDirective,
    DbNgxActionFromMapDirective,
    DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective,
    DbNgxActionSourceDirective,
    DbNgxActionHandlerDirective,
    DbNgxActionSuccessDirective,
    DbNgxActionKeyTriggerDirective,
    DbNgxActionDisabledDirective,
    DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionButtonTriggerDirective,
    DbNgxActionButtonDirective,
    DbNgxActionSnackbarDirective,
    DbNgxActionSnackbarComponent,
    DbNgxActionAutoTriggerDirective,
    DbNgxActionAutoTriggerValueDirective,
    DbNgxActionAutoModifyDirective,
    DbNgxActionValueDirective,
    DbNgxActionConfirmDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionWorkingComponent,
    DbNgxActionTransitionSafetyDirective,
    DbNgxActionContextLoggerDirective
  ]
})
export class DbNgxActionModule { }
