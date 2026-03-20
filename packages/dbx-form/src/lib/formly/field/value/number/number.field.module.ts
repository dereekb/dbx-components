import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatSliderModule } from '@ngx-formly/material/slider';
import { NgModule } from '@angular/core';

const importsAndExports = [FormlyMaterialModule, FormlyMatSliderModule];

/**
 * Provides Formly Material number input and slider support.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyNumberFieldModule {}
