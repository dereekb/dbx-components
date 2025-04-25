import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormRepeatArrayTypeComponent } from './array.field.component';

const importsAndExports = [DbxFormRepeatArrayTypeComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'repeatarray', component: DbxFormRepeatArrayTypeComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyArrayFieldModule {}
