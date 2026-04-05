import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { nameField, textAreaField, textField, toggleField, valueSelectionField, type ValueSelectionOption, forgeToggleField, forgeNameField, forgeTextField, forgeTextAreaField, forgeValueSelectionField, DbxFormlyFieldsContextDirective } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

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
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExpressionComponent {
  // Forge equivalent — basic fields without expression logic (forge uses Signal Forms reactivity)
  readonly forgeBasicFieldsConfig: FormConfig = {
    fields: [
      forgeToggleField({ key: 'toggle', label: 'Hide Toggle', description: 'This field is watched by another field to see when this is toggled on.' }),
      forgeNameField({}),
      forgeValueSelectionField({
        key: 'show',
        label: 'Select One',
        description: 'This selection is watched by the other fields.',
        options: SHOW_VALUE_SELECTION_VALUES.filter((x): x is { label: string; value: string } => 'value' in x)
      }),
      forgeTextField({ key: 'text', label: 'Text' }),
      forgeTextAreaField({ key: 'textarea', label: 'Text Area' })
    ]
  };

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
