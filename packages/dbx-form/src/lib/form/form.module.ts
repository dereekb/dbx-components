import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormValueChangesDirective } from './form.changes.directive';
import { DbxFormSourceDirective } from './form.input.directive';
import { DbxFormLoadingPairSourceDirective } from './loading/form.loading.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxFormSourceDirective,
    DbxFormValueChangesDirective,
    DbxFormLoadingPairSourceDirective
  ],
  exports: [
    DbxFormSourceDirective,
    DbxFormValueChangesDirective,
    DbxFormLoadingPairSourceDirective
  ]
})
export class DbxFormModule { }
