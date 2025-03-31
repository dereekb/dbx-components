import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormValueChangesDirective } from './form.changes.directive';
import { DbxFormSourceDirective } from './form.input.directive';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';

export const importsAndExports = [DbxFormSourceDirective, DbxFormValueChangesDirective, DbxFormLoadingSourceDirective];

/**
 * @deprecated import the directives directly instead.
 *
 * @see DbxFormSourceDirective
 * @see DbxFormValueChangesDirective
 * @see DbxFormLoadingSourceDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormIoModule {}
