import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
  DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
  DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
} from './directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
  ],
  exports: [
    DbNgxActionComponent, DbNgxActionContextDirective, DbNgxActionContextMapDirective, DbNgxActionFromMapDirective, DbNgxActionMapSourceDirective,
    DbNgxActionMapWorkingDisableDirective, DbNgxActionSourceDirective, DbNgxActionSourceDirective, DbNgxActionHandlerDirective, DbNgxActionDisabledDirective, DbNgxActionDisabledUntilModifiedDirective,
  ]
})
export class DbNgxCoreActionModule { }
