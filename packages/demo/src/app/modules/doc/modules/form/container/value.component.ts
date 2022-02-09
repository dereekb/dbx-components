import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { addressField, addressListField, cityField, countryField, emailField, nameField, stateField, textAreaField, textField, zipCodeField } from '@dereekb/dbx-form';

@Component({
  templateUrl: './value.component.html'
})
export class DocFormValueComponent {

  readonly textFields: FormlyFieldConfig[] = [
    textField({ key: 'test', label: 'Text Field', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
    nameField(),
    emailField(),
    cityField(),
    stateField(),
    countryField(),
    zipCodeField()
  ];

  readonly textAreaField: FormlyFieldConfig[] = [
    textAreaField({ key: 'test', label: 'Text Area Field', placeholder: 'Placeholder', required: true })
  ];

  readonly addressFields: FormlyFieldConfig[] = [
    addressField(),
    addressListField()
  ];

}
