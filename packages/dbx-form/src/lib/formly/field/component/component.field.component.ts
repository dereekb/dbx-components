import { Component } from '@angular/core';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';

export type DbxFormComponentFieldConfig<T> = DbxInjectionComponentConfig<T>

export interface DbxFormComponentFormlyFieldConfig<T = unknown> extends FormlyFieldConfig {
  componentField: DbxFormComponentFieldConfig<T>;
}

@Component({
  template: `
    <div class="dbx-form-component" dbx-injection [config]="config"></div>
  `
})
export class DbxFormComponentFieldComponent<T = unknown> extends FieldType<DbxFormComponentFormlyFieldConfig<T>> {

  get config(): DbxInjectionComponentConfig<T> {
    return this.field.componentField;
  }

}
