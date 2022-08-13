import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormFormlyArrayFieldModule } from './array/array.field.module';
import { DbxFormFormlyBooleanFieldModule } from './boolean/boolean.field.module';
import { DbxFormFormlyPhoneFieldModule } from './phone/phone.field.module';
import { DbxFormFormlyDateFieldModule } from './date/date.field.module';
import { DbxFormFormlyTextFieldModule } from './text/text.field.module';
import { DbxFormFormlyNumberFieldModule } from './number/number.field.module';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: [DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyNumberFieldModule, DbxFormFormlyTextFieldModule]
})
export class DbxFormFormlyValueModule {}
