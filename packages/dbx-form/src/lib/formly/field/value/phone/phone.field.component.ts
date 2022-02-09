import { Component } from '@angular/core';
import { ValidationErrors } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe } from '@dereekb/util';

export interface DbxInternationalPhoneFieldConfig {
  preferredCountries?: string[];
  onlyCountries?: string[];
}

export interface InternationalPhoneFormlyFieldConfig extends DbxInternationalPhoneFieldConfig, FormlyFieldConfig { }

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html',
  // TODO: styleUrls: ['./phone.scss']
})
export class DbxInternationalPhoneFieldComponent extends FieldType<InternationalPhoneFormlyFieldConfig> {

  get label(): Maybe<string> {
    return this.field.templateOptions!.label;
  }

  get placeholder(): Maybe<string> {
    return this.field.templateOptions!.placeholder;
  }

  get description(): Maybe<string> {
    return this.field.templateOptions!.description;
  }

  get preferredCountries(): string[] {
    return this.field.preferredCountries ?? DEFAULT_PREFERRED_COUNTRIES;
  }

  get onlyCountries(): string[] {
    return this.field.onlyCountries ?? [];
  }

  get required(): Maybe<boolean> {
    return this.field.templateOptions!.required;
  }

  get errors(): Maybe<ValidationErrors> {
    return this.field.formControl?.errors;
  }

}
