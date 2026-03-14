import { FormlyMaterialModule } from '@ngx-formly/material';
import { NgModule } from '@angular/core';
import { DbxFormFormlyWrapperModule } from '../../wrapper/wrapper.module';
import { FormlyMatInputModule } from '@ngx-formly/material/input';
import { DbxFormFormlyArrayFieldModule } from '../array/array.field.module';

const importsAndExports = [DbxFormFormlyArrayFieldModule, FormlyMaterialModule, FormlyMatInputModule, DbxFormFormlyWrapperModule];

/** Aggregates Formly Material input, array field, and wrapper modules for text field support. */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyTextFieldModule {}
