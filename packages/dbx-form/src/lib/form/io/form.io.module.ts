import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormValueChangesDirective } from './form.changes.directive';
import { DbxFormSourceDirective } from './form.input.directive';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxFormSourceDirective,
    DbxFormValueChangesDirective,
    DbxFormLoadingSourceDirective
  ],
  exports: [
    DbxFormSourceDirective,
    DbxFormValueChangesDirective,
    DbxFormLoadingSourceDirective
  ]
})
export class DbxFormIoModule { }
