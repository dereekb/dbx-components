import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { addressField, addressListField, cityField, countryField, emailField, phoneField, nameField, phoneAndLabelSectionField, wrappedPhoneAndLabelField, repeatArrayField, stateField, textAreaField, textField, zipCodeField, phoneListField, dateTimeField, DbxDateTimeFieldTimeMode, toggleField, checkboxField, numberField } from '@dereekb/dbx-form';

@Component({
  templateUrl: './value.component.html'
})
export class DocFormValueComponent {
  readonly textFields: FormlyFieldConfig[] = [textField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }), nameField(), emailField(), cityField(), stateField(), countryField(), zipCodeField()];

  readonly numberFields: FormlyFieldConfig[] = [numberField({ key: 'test', label: 'Number Field', description: 'A required number between 0 and 100.', placeholder: 'Placeholder', required: true, min: 0, max: 100 })];

  readonly textAreaField: FormlyFieldConfig[] = [textAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })];

  readonly dateTimeFields: FormlyFieldConfig[] = [
    dateTimeField({ key: 'date', required: true, description: 'This is the default date field that requires the user pick a date and time.' }),
    dateTimeField({ key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL, description: 'This date field is for picking a day, with an optional time.' }),
    dateTimeField({ key: 'dayOnly', timeMode: DbxDateTimeFieldTimeMode.NONE, description: 'This date field is for picking a day only.' }),
    dateTimeField({ key: 'timeOnly', timeOnly: true, description: 'This date field is for picking a time only.' })
  ];

  readonly addressFields: FormlyFieldConfig[] = [addressField(), addressListField()];

  readonly toggleField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      description: 'this is a toggle field'
    })
  ];

  readonly checkboxField: FormlyFieldConfig[] = [
    checkboxField({
      key: 'checkbox',
      description: 'this is a checkbox field'
    })
  ];

  readonly repeatArrayFields: FormlyFieldConfig[] = [
    repeatArrayField({
      key: 'test',
      label: 'Test Field',
      addText: 'Add Test Field',
      removeText: 'Remove Test Field',
      repeatFieldGroup: [nameField(), emailField(), phoneAndLabelSectionField(), addressListField()]
    })
  ];

  readonly phoneFields: FormlyFieldConfig[] = [
    phoneField(),
    wrappedPhoneAndLabelField({
      phoneField: {
        key: 'labeledPhoneKey'
      }
    }),
    phoneAndLabelSectionField({
      key: 'section'
    })
  ];

  readonly phoneListField: FormlyFieldConfig[] = [phoneListField()];
}
