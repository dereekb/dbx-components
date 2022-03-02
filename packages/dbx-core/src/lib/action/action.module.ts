import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
  DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
  DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
  DbNgxActionAutoTriggerDirective, DbNgxActionAutoTriggerValueDirective, DbNgxActionAutoModifyDirective, DbNgxActionValueDirective, DbNgxActionContextLoggerDirective,
  DbNgxActionSuccessComponent, DbNgxActionSuccessDirective, DbNgxActionWorkingComponent
} from './directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionAutoTriggerDirective, DbNgxActionAutoTriggerValueDirective, DbNgxActionAutoModifyDirective, DbNgxActionValueDirective, DbNgxActionContextLoggerDirective,
    DbNgxActionSuccessComponent, DbNgxActionSuccessDirective, DbNgxActionWorkingComponent
  ],
  exports: [
    DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionAutoTriggerDirective, DbNgxActionAutoTriggerValueDirective, DbNgxActionAutoModifyDirective, DbNgxActionValueDirective, DbNgxActionContextLoggerDirective,
    DbNgxActionSuccessComponent, DbNgxActionSuccessDirective, DbNgxActionWorkingComponent
  ]
})
export class DbNgxCoreActionModule { }
