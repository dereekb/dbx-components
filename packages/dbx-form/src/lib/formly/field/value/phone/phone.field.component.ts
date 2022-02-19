import { Component } from '@angular/core';
import { FieldType } from '@ngx-formly/material';   // extend FieldType from Material, not core!
import { FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxInternationalPhoneFieldConfig {
  preferredCountries?: string[];
  onlyCountries?: string[];
}

export interface InternationalPhoneFormlyFieldConfig extends FormlyFieldConfig {
  phoneField: DbxInternationalPhoneFieldConfig;
}

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html'
})
export class DbxPhoneFieldComponent extends FieldType<InternationalPhoneFormlyFieldConfig & FieldTypeConfig> {

  get phoneField(): DbxInternationalPhoneFieldConfig {
    return this.field.phoneField;
  }

  get preferredCountries(): string[] {
    return this.phoneField.preferredCountries ?? DEFAULT_PREFERRED_COUNTRIES;
  }

  get onlyCountries(): string[] {
    return this.phoneField.onlyCountries ?? [];
  }

}
