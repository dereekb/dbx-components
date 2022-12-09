import { NgModule } from '@angular/core';
import { DbxFormlyModule } from './formly/formly.module';
import { DbxFormModule } from './form/form.module';
import { DbxFormFormlyFieldModule } from './formly/field/form.field.module';
import { DbxFormFormlyFormModule } from './formly/form/form.form.module';

@NgModule({
  exports: [DbxFormModule, DbxFormlyModule, DbxFormFormlyFieldModule, DbxFormFormlyFormModule]
})
export class DbxFormExtensionModule {}
