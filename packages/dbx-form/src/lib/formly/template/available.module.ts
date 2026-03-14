import { NgModule } from '@angular/core';
import { DbxFormFormlyTextFieldModule } from '../field/value/text/text.field.module';
import { DbxFormFormlyWrapperModule } from '../field/wrapper/wrapper.module';

const importsAndExports = [DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule];

/**
 * Angular module that provides the dependencies needed for the text availability field template.
 *
 * Imports and re-exports the text field and wrapper modules required by {@link textIsAvailableField}.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormTextAvailableFieldModule {}
