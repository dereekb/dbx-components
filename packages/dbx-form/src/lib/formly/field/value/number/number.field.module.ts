import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatSliderModule } from '@ngx-formly/material/slider';
import { NgModule } from '@angular/core';
import { DbxFormFormlyWrapperModule } from '../../wrapper/form.wrapper.module';

@NgModule({
  imports: [FormlyMaterialModule, FormlyMatSliderModule],
  declarations: [],
  exports: [DbxFormFormlyWrapperModule]
})
export class DbxFormFormlyNumberFieldModule {}
