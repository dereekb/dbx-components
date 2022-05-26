import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormFormlyArrayFieldModule } from './array/array.field.module';
import { DbxFormFormlyBooleanFieldModule } from './boolean/boolean.field.module';
import { DbxFormFormlyEnumFieldModule } from './enum/enum.field.module';
import { DbxFormFormlyPhoneFieldModule } from './phone/phone.field.module';
import { DbxFormFormlyDateFieldModule } from './date/date.field.module';
import { DbxFormFormlyTextFieldModule } from './text/text.field.module';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: [DbxFormFormlyArrayFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyDateFieldModule, DbxFormFormlyEnumFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyTextFieldModule]
})
export class DbxFormFormlyValueModule {}
