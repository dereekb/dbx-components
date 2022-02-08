import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
  DbxActionDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
  DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
  DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
  DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
} from './directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxActionDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
    DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
    DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
  ],
  exports: [
    DbxActionDirective, DbxActionContextMapDirective, DbxActionFromMapDirective, DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective, DbxActionSourceDirective, DbxActionHandlerDirective, DbxActionDisabledDirective, DbxActionDisabledUntilModifiedDirective,
    DbxActionAutoTriggerDirective, DbxActionAutoTriggerValueDirective, DbxActionAutoModifyDirective, DbxActionValueDirective, DbxActionContextLoggerDirective,
    DbxActionSuccessComponent, DbxActionSuccessDirective, DbxActionWorkingComponent
  ]
})
export class DbxCoreActionModule { }
