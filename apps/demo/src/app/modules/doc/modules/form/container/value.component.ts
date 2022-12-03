import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { addressField, addressListField, cityField, countryField, emailField, phoneField, nameField, phoneAndLabelSectionField, wrappedPhoneAndLabelField, repeatArrayField, stateField, textAreaField, textField, zipCodeField, phoneListField, dateTimeField, DbxDateTimeFieldTimeMode, toggleField, checkboxField, numberField, latLngTextField, DbxDateTimeValueMode, dateRangeField, dollarAmountField } from '@dereekb/dbx-form';
import { addDays } from 'date-fns';
import { addSuffixFunction, randomBoolean } from '@dereekb/util';

@Component({
  templateUrl: './value.component.html'
})
export class DocFormValueComponent {
  readonly dateValues = {
    date: addDays(new Date(), -12),
    dateAsString: addDays(new Date(), -6),
    dayOnly: addDays(new Date(), 6),
    dayOnlyAsString: addDays(new Date(), 12)
  };

  readonly textFields: FormlyFieldConfig[] = [
    //
    textField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
    textField({ key: 'transform', label: 'Transformed Text Field', description: 'Text Field With String Transform Config. Adds _ between each letter as you type.', transform: { trim: true, transform: addSuffixFunction('_') } }),
    nameField(),
    emailField(),
    cityField(),
    stateField(),
    stateField({ label: 'State With Code Input', key: 'stateAsCode', asCode: true }),
    countryField(),
    zipCodeField()
  ];

  readonly numberFields: FormlyFieldConfig[] = [
    //
    numberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
    numberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
    numberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
    dollarAmountField({ key: 'dollars', label: 'dollarAmountField()', description: 'Dollar amount field.' })
  ];

  readonly textAreaField: FormlyFieldConfig[] = [textAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })];

  readonly latLngTextField: FormlyFieldConfig[] = [latLngTextField()];

  readonly dateTimeFields: FormlyFieldConfig[] = [
    dateTimeField({ key: 'date', required: true, description: 'This is the default date field that requires the user pick a date and time.' }),
    dateTimeField({ key: 'dateAsString', required: true, valueMode: DbxDateTimeValueMode.DATE_STRING, description: 'This date field returns the value as an ISO8601DateString. The date hint is also hidden.', hideDateHint: true }),
    dateTimeField({ key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL, description: 'This date field is for picking a day, with an optional time.' }),
    dateTimeField({ key: 'dayOnly', timeMode: DbxDateTimeFieldTimeMode.NONE, description: 'This date field is for picking a day only.' }),
    dateTimeField({ key: 'dayOnlyAsString', timeMode: DbxDateTimeFieldTimeMode.NONE, valueMode: DbxDateTimeValueMode.DAY_STRING, description: 'This date field is for picking a day only and as an ISO8601DayString.' }),
    dateTimeField({ key: 'timeOnly', timeOnly: true, description: 'This date field is for picking a time only. The date hint is also hidden.', hideDateHint: true })
  ];

  readonly dateRangeFields: FormlyFieldConfig[] = [dateRangeField({})];

  readonly addressFields: FormlyFieldConfig[] = [
    //
    addressField(),
    addressField({ key: 'slim', hint: 'Line 1 and country are omitted.', stateField: { asCode: true }, includeLine2: false, includeCountry: false }),
    addressListField()
  ];

  readonly toggleField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      label: 'Toggle Me',
      description: 'this is a toggle field'
    })
  ];

  readonly checkboxField: FormlyFieldConfig[] = [
    checkboxField({
      key: 'checkbox',
      label: 'Check Me',
      description: 'this is a checkbox field'
    })
  ];

  readonly repeatArrayValue = {
    test2: [
      {
        name: 'hello',
        disable: false
      },
      {
        name: 'start with disable=true',
        disable: true
      }
    ]
  };

  readonly repeatArrayFields: FormlyFieldConfig[] = [
    repeatArrayField({
      key: 'test',
      label: 'Test Field',
      description: 'This is a generic repeat field. It is configured with custom add/remove text, and a max of 2 items.',
      addText: 'Add Test Field',
      removeText: 'Remove Test Field',
      repeatFieldGroup: [nameField(), emailField(), phoneAndLabelSectionField(), addressListField()],
      maxLength: 2
    }),
    repeatArrayField<{ name: string; disable: boolean }>({
      key: 'test2',
      label: 'Field With Add and Remove Diabled Via Field',
      description: 'Shows the remove button being disabled when a value is a certain value, and shows the duplicate button.',
      duplicateText: 'Make Copy',
      repeatFieldGroup: [
        nameField(),
        toggleField({
          key: 'disable',
          label: 'Disable Remove'
        })
      ],
      addTemplate: (i) => ({ name: `New Item ${i}`, disable: randomBoolean() }),
      disableRearrange: true,
      allowAdd: true,
      allowDuplicate: true,
      allowRemove: ({ i, value }) => !(value as { disable: boolean })?.disable,
      labelForField: ({ value }) => (value as { name: string })?.name,
      addDuplicateToEnd: true
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
