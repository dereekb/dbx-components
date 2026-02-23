import { NgModule } from '@angular/core';
import { DbxFormModule } from './form/form.module';
import { DbxFormFormlyFieldModule } from './formly/field/form.field.module';

@NgModule({
  exports: [DbxFormModule, DbxFormFormlyFieldModule]
})
export class DbxFormExtensionModule {}
