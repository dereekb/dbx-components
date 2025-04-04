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
  DbxActionValueStreamDirective,
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
  DbxActionValueStreamDirective,
  DbxActionAutoModifyDirective,
  DbxActionValueDirective,
  DbxActionContextLoggerDirective,
  DbxActionPreSuccessDirective,
  DbxActionHasSuccessDirective,
  DbxActionSuccessHandlerDirective,
  DbxActionIsWorkingDirective
];

/**
 * Contains all base DbxAction components.
 */
@NgModule({
  imports: declarations,
  exports: declarations
})
export class DbxCoreActionModule {}
