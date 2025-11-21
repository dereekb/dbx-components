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
  DbxActionIdleDirective,
  DbxActionHandlerValueDirective,
  DbxActionErrorHandlerDirective
} from './directive';

const importsAndExports = [
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
  DbxActionIdleDirective,
  DbxActionPreSuccessDirective,
  DbxActionHasSuccessDirective,
  DbxActionSuccessHandlerDirective,
  DbxActionErrorHandlerDirective,
  DbxActionIsWorkingDirective
];

/**
 * Contains all base DbxAction components.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCoreActionModule {}
