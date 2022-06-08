import { Component } from '@angular/core';
import { FieldType } from '@ngx-formly/material'; // extend FieldType from Material, not core!
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { Maybe } from '@dereekb/util';

export interface InternationalPhoneFormlyFieldProps extends FormlyFieldProps {
  preferredCountries?: Maybe<string[]>;
  onlyCountries?: Maybe<string[]>;
}

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html'
})
export class DbxPhoneFieldComponent extends FieldType<FieldTypeConfig<InternationalPhoneFormlyFieldProps>> {
  get preferredCountries(): string[] {
    return this.props.preferredCountries ?? DEFAULT_PREFERRED_COUNTRIES;
  }

  get onlyCountries(): string[] {
    return this.props.onlyCountries ?? [];
  }
}
