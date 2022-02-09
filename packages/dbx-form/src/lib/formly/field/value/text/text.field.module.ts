import { FormlyMaterialModule } from '@ngx-formly/material';
import { NgModule } from '@angular/core';
import { DbxFormFormlyWrapperModule } from '../../wrapper/form.wrapper.module';

@NgModule({
  imports: [
    FormlyMaterialModule
  ],
  declarations: [],
  exports: [
    DbxFormFormlyWrapperModule
  ]
})
export class DbxFormFormlyTextFieldModule { }
