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
  DbxActionPreSuccessDirective,
  DbxActionHandlerValueDirective
} from './directive';

const declarations = [
  DbxActionDirective,
  DbxActionContextMapDirective,
  DbxActionFromMapDirective,
  DbxActionMapSourceDirective,
  DbxActionMapWorkingDisableDirective,
  DbxActionSourceDirective,
  DbxActionHandlerDirective,
  DbxActionHandlerValueDirective,
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
];

/**
 * @deprecated all components are now standalone. Import them directly instead.
 */
@NgModule({
  imports: declarations,
  exports: declarations
})
export class DbxCoreActionModule {}
