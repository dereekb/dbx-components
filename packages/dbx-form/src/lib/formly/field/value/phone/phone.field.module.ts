import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxPhoneFieldComponent } from './phone.field.component';

const importsAndExports = [DbxPhoneFieldComponent];

/**
 * Registers the `intphone` Formly field type for international phone number input.
 */
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
