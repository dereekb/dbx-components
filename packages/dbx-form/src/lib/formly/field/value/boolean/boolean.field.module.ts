import { NgModule } from '@angular/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatCheckboxModule } from '@ngx-formly/material/checkbox';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';

const importsAndExports = [FormlyMaterialModule, FormlyMatCheckboxModule, FormlyMatToggleModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFormFormlyBooleanFieldModule {}
