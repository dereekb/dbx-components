import { Component } from '@angular/core';
import { ValidationErrors, FormGroup } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe } from '@dereekb/util';

export interface DbxInternationalPhoneFieldConfig {
  preferredCountries?: string[];
  onlyCountries?: string[];
}

export interface InternationalPhoneFormlyFieldConfig extends DbxInternationalPhoneFieldConfig, FormlyFieldConfig { }

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html'
})
export class DbxInternationalPhoneFieldComponent extends FieldType<InternationalPhoneFormlyFieldConfig & FieldTypeConfig> {

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get formControlName(): string {
    return this.key as string;
  }

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

  get required(): boolean {
    return this.field.templateOptions!.required ?? false;
  }

  get errors(): Maybe<ValidationErrors> {
    return this.field.formControl?.errors;
  }

}
