import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxFormValueChangesDirective } from './form.changes.directive';
import { DbNgxFormSourceDirective } from './form.input.directive';
import { DbNgxFormLoadingPairSourceDirective } from './loading/form.loading.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxFormSourceDirective,
    DbNgxFormValueChangesDirective,
    DbNgxFormLoadingPairSourceDirective
  ],
  exports: [
    DbNgxFormSourceDirective,
    DbNgxFormValueChangesDirective,
    DbNgxFormLoadingPairSourceDirective
  ]
})
export class DbNgxFormModule { }
