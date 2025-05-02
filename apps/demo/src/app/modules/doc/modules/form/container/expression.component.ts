import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { nameField, textAreaField, textField, toggleField, valueSelectionField, ValueSelectionOption, DbxFormlyFieldsContextDirective } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';

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
  templateUrl: './expression.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective]
})
export class DocFormExpressionComponent {
  readonly hideExpressionField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      label: 'Hide Toggle',
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
