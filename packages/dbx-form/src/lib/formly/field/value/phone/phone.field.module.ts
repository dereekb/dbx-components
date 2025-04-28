import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPhoneFieldComponent } from './phone.field.component';

const importsAndExports = [DbxPhoneFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'intphone', component: DbxPhoneFieldComponent, wrappers: ['form-field'] }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyPhoneFieldModule {}
