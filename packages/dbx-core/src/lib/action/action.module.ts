import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
  DbxActionComponent, DbxActionContextDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
  DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
  DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
  DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
} from './directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxActionComponent, DbxActionContextDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
    DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
    DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
  ],
  exports: [
    DbxActionComponent, DbxActionContextDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
    DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
    DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
  ]
})
export class DbxCoreActionModule { }
