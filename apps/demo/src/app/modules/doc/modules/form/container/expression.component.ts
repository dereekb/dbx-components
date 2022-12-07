import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { nameField, textAreaField, textField, toggleField, valueSelectionField, ValueSelectionOption } from '@dereekb/dbx-form';

export const SHOW_VALUE_SELECTION_VALUES: ValueSelectionOption<string>[] = [
  {
    label: 'Text Field',
    value: 'text'
  },
  {
    label: 'Text Area Field',
    value: 'textarea'
  }
];

@Component({
  templateUrl: './expression.component.html'
})
export class DocFormExpressionComponent {
  readonly hideExpressionField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      description: 'this field is watched by another field to see when this is toggled on.'
    }),
    nameField({
      expressions: {
        hide: '!model.toggle'
      }
    }),
    valueSelectionField({
      key: 'show',
      label: 'Select One',
      description: 'This selection is watched by the other fields to toggle showing/hiding based on the selected value.',
      addClearOption: true,
      options: SHOW_VALUE_SELECTION_VALUES
    }),
    textField({
      key: 'text',
      expressions: {
        hide: (field: FormlyFieldConfig) => field.model.show !== 'text'
      }
    }),
    textAreaField({
      key: 'text',
      expressions: {
        hide: (field: FormlyFieldConfig) => field.model.show !== 'textarea'
      }
    })
  ];
}
