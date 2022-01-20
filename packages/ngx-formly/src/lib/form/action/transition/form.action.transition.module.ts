import { MatDialogModule } from '@angular/material/dialog';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxActionFormSafetyDirective } from './form.action.transition.safety.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxActionFormSafetyDirective
  ],
  exports: [
    DbNgxActionFormSafetyDirective
  ]
})
export class DbNgxFormlyActionTransitionModule { }
