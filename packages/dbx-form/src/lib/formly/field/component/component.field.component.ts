import { Component } from '@angular/core';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFormComponentFieldConfig<T> extends DbxInjectionComponentConfig<T> { }

export interface DbxFormComponentFormlyFieldConfig<T = any> extends FormlyFieldConfig {
  componentField: DbxFormComponentFieldConfig<T>;
}

@Component({
  template: `
    <div class="dbx-form-component" dbx-injection [config]="config"></div>
  `
})
export class DbxFormComponentFieldComponent<T = any> extends FieldType<DbxFormComponentFormlyFieldConfig<T>> {

  get config(): DbxInjectionComponentConfig<T> {
    return this.field.componentField;
  }

}
