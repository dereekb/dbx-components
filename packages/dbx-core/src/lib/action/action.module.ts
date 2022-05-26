import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
  DbxActionDirective,
  DbxActionContextMapDirective,
  DbxActionFromMapDirective,
  DbxActionMapSourceDirective,
  DbxActionMapWorkingDisableDirective,
  DbxActionSourceDirective,
  DbxActionHandlerDirective,
  DbxActionDisabledDirective,
  DbxActionEnforceModifiedDirective,
  DbxActionAutoTriggerDirective,
  dbxActionValueStreamDirective,
  DbxActionAutoModifyDirective,
  DbxActionValueDirective,
  DbxActionContextLoggerDirective,
  DbxActionHasSuccessDirective,
  DbxActionSuccessHandlerDirective,
  DbxActionIsWorkingDirective
} from './directive';

@NgModule({
  imports: [CommonModule],
  declarations: [
    DbxActionDirective,
    DbxActionContextMapDirective,
    DbxActionFromMapDirective,
    DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective,
    DbxActionSourceDirective,
    DbxActionHandlerDirective,
    DbxActionDisabledDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionAutoTriggerDirective,
    dbxActionValueStreamDirective,
    DbxActionAutoModifyDirective,
    DbxActionValueDirective,
    DbxActionContextLoggerDirective,
    DbxActionHasSuccessDirective,
    DbxActionSuccessHandlerDirective,
    DbxActionIsWorkingDirective
  ],
  exports: [
    DbxActionDirective,
    DbxActionContextMapDirective,
    DbxActionFromMapDirective,
    DbxActionMapSourceDirective,
    DbxActionMapWorkingDisableDirective,
    DbxActionSourceDirective,
    DbxActionHandlerDirective,
    DbxActionDisabledDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionAutoTriggerDirective,
    dbxActionValueStreamDirective,
    DbxActionAutoModifyDirective,
    DbxActionValueDirective,
    DbxActionContextLoggerDirective,
    DbxActionHasSuccessDirective,
    DbxActionSuccessHandlerDirective,
    DbxActionIsWorkingDirective
  ]
})
export class DbxCoreActionModule {}
