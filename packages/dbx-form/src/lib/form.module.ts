import { NgModule } from '@angular/core';
import { DbxFormlyModule } from './formly/formly.module';
import { DbxFormFormlyFieldModule } from './formly/field/form.field.module';
import { DbxFormModule } from './form/form.module';

@NgModule({
  exports: [DbxFormModule, DbxFormlyModule, DbxFormFormlyFieldModule]
})
export class DbxFormExtensionModule {}
