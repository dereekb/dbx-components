import { NgModule } from '@angular/core';
import { DbxFormValueChangeDirective } from './form.change.directive';
import { DbxFormSourceDirective } from './form.input.directive';
import { DbxFormLoadingSourceDirective } from './form.loading.directive';

const importsAndExports = [DbxFormSourceDirective, DbxFormValueChangeDirective, DbxFormLoadingSourceDirective];

/**
 * @deprecated import the directives directly instead.
 *
 * @see DbxFormSourceDirective
 * @see DbxFormValueChangeDirective
 * @see DbxFormLoadingSourceDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormIoModule {}
