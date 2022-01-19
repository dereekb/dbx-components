import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxActionComponent } from './action.component';
import { DbNgxActionContextDirective } from './action.directive';
import { DbNgxActionAutoTriggerDirective } from './autotrigger.directive';
import { DbNgxActionHandlerDirective } from './handler.directive';
import { DbNgxActionSuccessDirective } from './success.directive';
import { DbNgxActionValueDirective } from './value.directive';
import { DbNgxActionFromMapDirective } from './action.map.key.directive';
import { DbNgxActionMapSourceDirective } from './action.map.source.directive';
import { DbNgxActionContextMapDirective } from './action.map.directive';
import { DbNgxActionMapWorkingDisableDirective } from './action.map.working.disable.directive';
import { DbNgxActionSourceDirective } from './action.source.directive';
import { DbNgxActionDisabledDirective } from './action.disabled.directive';
import { DbNgxActionAutoModifyDirective } from './automodify.directive';
import { DbNgxActionAutoTriggerValueDirective } from './autotrigger.value.directive';
import { DbNgxActionDisabledUntilModifiedDirective } from './action.disabled.modified.directive';
import { DbNgxActionContextLoggerDirective } from './action.logger.directive';
import { DbNgxActionSuccessComponent } from './success.component';
import { DbNgxActionWorkingComponent } from './working.component';

@NgModule({
  imports: [
    CommonModule
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
    DbNgxActionDisabledDirective,
    DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionAutoTriggerDirective,
    DbNgxActionAutoTriggerValueDirective,
    DbNgxActionAutoModifyDirective,
    DbNgxActionValueDirective,
    DbNgxActionContextLoggerDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionSuccessDirective,
    DbNgxActionWorkingComponent
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
    DbNgxActionDisabledDirective,
    DbNgxActionDisabledUntilModifiedDirective,
    DbNgxActionAutoTriggerDirective,
    DbNgxActionAutoTriggerValueDirective,
    DbNgxActionAutoModifyDirective,
    DbNgxActionValueDirective,
    DbNgxActionContextLoggerDirective,
    DbNgxActionSuccessComponent,
    DbNgxActionSuccessDirective,
    DbNgxActionWorkingComponent
  ]
})
export class DbNgxCoreActionModule { }
