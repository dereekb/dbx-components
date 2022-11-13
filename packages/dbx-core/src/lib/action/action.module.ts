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
  DbxActionIsWorkingDirective,
  DbxActionDisabledOnSuccessDirective,
  DbxActionPreSuccessDirective
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
    DbxActionDisabledOnSuccessDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionAutoTriggerDirective,
    dbxActionValueStreamDirective,
    DbxActionAutoModifyDirective,
    DbxActionValueDirective,
    DbxActionContextLoggerDirective,
    DbxActionPreSuccessDirective,
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
    DbxActionDisabledOnSuccessDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionAutoTriggerDirective,
    dbxActionValueStreamDirective,
    DbxActionAutoModifyDirective,
    DbxActionValueDirective,
    DbxActionContextLoggerDirective,
    DbxActionPreSuccessDirective,
    DbxActionHasSuccessDirective,
    DbxActionSuccessHandlerDirective,
    DbxActionIsWorkingDirective
  ]
})
export class DbxCoreActionModule {}
