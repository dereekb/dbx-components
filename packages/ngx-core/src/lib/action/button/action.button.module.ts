import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxActionButtonTriggerDirective } from './action.button.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxActionButtonTriggerDirective
  ],
  exports: [
    DbNgxActionButtonTriggerDirective
  ]
})
export class DbNgxActionButtonModule { }
