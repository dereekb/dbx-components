import { NgModule } from '@angular/core';
import { DbxFormFormlyArrayFieldModule } from './array/array.field.module';
import { DbxFormFormlyPhoneFieldModule } from './phone/phone.field.module';
import { DbxFormFormlyDateFieldModule } from './date/date.field.module';
import { DbxFormFormlyTextFieldModule } from './text/text.field.module';
import { DbxFormFormlyNumberFieldModule } from './number/number.field.module';

const importsAndExports = [DbxFormFormlyArrayFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyTextFieldModule];

/**
 * @deprecated import the modules directly
 *
 * @see DbxFormFormlyArrayFieldModule
 * @see DbxFormFormlyDateFieldModule
 * @see DbxFormFormlyPhoneFieldModule
 * @see DbxFormFormlyNumberFieldModule
 * @see DbxFormFormlyTextFieldModule
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyValueModule {}
