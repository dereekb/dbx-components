import { Component } from '@angular/core';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFormComponentFieldConfig<T> extends DbxInjectedComponentConfig<T> { }

export interface DbxFormComponentFormlyFieldConfig<T = any> extends FormlyFieldConfig {
  componentField: DbxFormComponentFieldConfig<T>;
}

@Component({
  template: `
    <div class="dbx-form-component" dbx-injected-content [config]="config"></div>
  `
})
export class DbxFormComponentFieldComponent<T = any> extends FieldType<DbxFormComponentFormlyFieldConfig<T>> {

  get config(): DbxInjectedComponentConfig<T> {
    return this.field.componentField;
  }

}
