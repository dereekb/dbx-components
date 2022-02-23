import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxActionFormSafetyDirective } from './form.action.transition.safety.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxActionFormSafetyDirective
  ],
  exports: [
    DbxActionFormSafetyDirective
  ]
})
export class DbxFormActionTransitionModule { }
