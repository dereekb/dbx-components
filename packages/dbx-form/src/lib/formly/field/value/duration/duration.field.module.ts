import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxTimeDurationFieldComponent } from './duration.field.component';
import { DbxDurationPickerPopoverComponent } from './duration.picker.popover.component';

const importsAndExports = [DbxTimeDurationFieldComponent, DbxDurationPickerPopoverComponent];

/**
 * Registers the `timeduration` Formly field type for time duration input with text parsing and popover picker.
 */
@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'timeduration', component: DbxTimeDurationFieldComponent, wrappers: ['form-field'] }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyDurationFieldModule {}
