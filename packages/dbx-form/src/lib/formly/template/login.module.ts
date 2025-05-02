import { NgModule } from '@angular/core';
import { DbxFormFormlyTextFieldModule } from '../field/value/text/text.field.module';

const importsAndExports = [DbxFormFormlyTextFieldModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormLoginFieldModule {}
