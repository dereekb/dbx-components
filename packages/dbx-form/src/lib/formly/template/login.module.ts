import { NgModule } from '@angular/core';
import { DbxFormFormlyTextFieldModule } from '../field/value/text/text.field.module';

const importsAndExports = [DbxFormFormlyTextFieldModule];

/**
 * Angular module that provides the dependencies needed for login form field templates.
 *
 * Imports and re-exports the text field module required by the username/password login field functions.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormLoginFieldModule {}
