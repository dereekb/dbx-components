import { NgModule } from '@angular/core';
import { DbxFormFormlyTextFieldModule } from '../field/value/text/text.field.module';
import { DbxFormFormlyWrapperModule } from '../field/wrapper/wrapper.module';

const importsAndExports = [DbxFormFormlyTextFieldModule, DbxFormFormlyWrapperModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormTextAvailableFieldModule {}
