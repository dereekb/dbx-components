import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxForgeTextField, dbxForgeTextAreaField, dbxForgeNumberField, dbxForgeNumberSliderField, dbxForgeDollarAmountField, dbxForgeToggleField, dbxForgeCheckboxField, dbxForgeNameField, dbxForgeEmailField, dbxForgeCityField, dbxForgeStateField, dbxForgeCountryField, dbxForgeZipCodeField, dbxForgePhoneField, dbxForgeAddressGroup, dbxForgeAddressListField, dbxForgeValueSelectionField } from '@dereekb/dbx-form';
import { addDays, startOfDay } from 'date-fns';
import { addSuffixFunction } from '@dereekb/util';
import { of } from 'rxjs';
import { dateTimezoneUtcNormal } from '@dereekb/date';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';

@Component({
  templateUrl: './value.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormValueComponent {
  readonly dateValues$ = of({
    date: startOfDay(new Date()),
    dateAsString: addDays(new Date(), -6),
    dayOnly: addDays(new Date(), 6),
    dayOnlyAsString: addDays(new Date(), 12),
    dateOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'Asia/Tokyo' }).systemDateToTargetDate(startOfDay(new Date())),
    timeOnlyWithLockedTimezone: dateTimezoneUtcNormal({ timezone: 'America/New_York' }).systemDateToTargetDate(startOfDay(new Date()))
  });

  readonly forgeTextFieldsConfig: FormConfig = {
    fields: [
      dbxForgeTextField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
      dbxForgeTextField({ key: 'transform', label: 'Transformed Text Field', description: 'Text Field With String Transform Config. Adds _ between each letter as you type.', idempotentTransform: { trim: true, transform: addSuffixFunction('_') } }),
      dbxForgeNameField(),
      dbxForgeEmailField(),
      dbxForgeCityField(),
      dbxForgeStateField(),
      dbxForgeStateField({ label: 'State With Code Input', key: 'stateAsCode', asCode: true }),
      dbxForgeCountryField(),
      dbxForgeZipCodeField(),
      dbxForgeToggleField({ key: 'showLogicDemo', label: 'Show Logic Demo Field' }),
      dbxForgeTextField({
        key: 'logicDemo',
        label: 'Conditionally Visible Text',
        description: 'Hidden unless the toggle above is on. Demonstrates logic support on forge fields.',
        logic: [
          {
            type: 'hidden',
            condition: {
              type: 'fieldValue',
              fieldPath: 'showLogicDemo',
              operator: 'notEquals',
              value: true
            }
          }
        ]
      }),
      dbxForgeToggleField({ key: 'showSelectionLogicDemo', label: 'Show Selection Logic Demo Field' }),
      dbxForgeValueSelectionField({
        key: 'selectionLogicDemo',
        label: 'Conditionally Visible Selection',
        description: 'Hidden unless the toggle above is on.',
        props: {
          options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' }
          ]
        },
        logic: [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'showSelectionLogicDemo', operator: 'notEquals', value: true } }]
      })
    ]
  };

  readonly forgeNumberFieldsConfig: FormConfig = {
    fields: [
      dbxForgeNumberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
      dbxForgeNumberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
      dbxForgeNumberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
      dbxForgeDollarAmountField({ key: 'dollars', label: 'dbxForgeDollarAmountField()', description: 'Dollar amount field.' })
    ]
  } as const satisfies FormConfig;

  readonly forgeNumberSliderFieldsConfig: FormConfig = {
    fields: [
      dbxForgeNumberSliderField({ key: 'test', label: 'dbxForgeNumberSliderField()', hint: 'A number between 0 and 100 picked with a slider.', min: 0, max: 100 }),
      dbxForgeNumberSliderField({ key: 'steptest', label: 'dbxForgeNumberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', min: 0, max: 100, step: 5 }),
      dbxForgeNumberSliderField({ key: 'steptestcustomtickinterval', label: 'dbxForgeNumberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', min: 0, max: 100, step: 5, tickInterval: 5 })
      // dbxForgeNumberSliderField({ key: 'validated', label: 'Validated Slider (must be > first slider)', description: 'Cross-field expression validator: value must be greater than the first slider.', min: 0, max: 100, validators: [{ type: 'custom' as const, expression: 'fieldValue > formValue.test', kind: 'mustBeGreaterThanTest' }], validationMessages: { mustBeGreaterThanTest: 'Value must be greater than the first slider' } })
    ]
  };

  readonly forgeTextAreaFieldConfig: FormConfig = {
    fields: [dbxForgeTextAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })]
  };

  readonly forgeAddressFieldConfig: FormConfig = {
    fields: [
      dbxForgeAddressGroup(),
      {
        type: 'container',
        key: 'test',
        wrappers: [],
        fields: []
      }
    ]
  };

  readonly forgeSlimAddressFieldConfig: FormConfig = {
    fields: [dbxForgeAddressGroup({ key: 'slim', stateField: { asCode: true }, includeLine2: false, includeCountry: false }) as any]
  };

  readonly forgeAddressListFieldConfig: FormConfig = {
    fields: [dbxForgeAddressListField() as any]
  };

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      dbxForgeToggleField({
        key: 'toggle',
        label: 'Toggle Me',
        description: 'this is a toggle field'
      }),
      dbxForgeToggleField({
        key: 'toggleWrapperLabel',
        label: 'Wrapper notch',
        description: "showLabelAt: 'wrapper' — label appears in the notched outline.",
        showLabelAt: 'wrapper'
      }),
      dbxForgeToggleField({
        key: 'toggleBothLabel',
        label: 'Both',
        description: "showLabelAt: 'both' — duplicates the label in the notch and inside the box.",
        showLabelAt: 'both'
      }),
      dbxForgeToggleField({
        key: 'toggleContentLabel',
        label: 'Toggle Me',
        description: 'contentLabel — explicit secondary label inside the box.',
        showLabelAt: 'wrapper',
        contentLabel: 'Helper text rendered via contentLabel'
      })
    ]
  };

  readonly forgeToggleNoBoxFieldConfig: FormConfig = {
    fields: [
      dbxForgeToggleField({
        key: 'toggle',
        label: 'Toggle Me',
        description: 'this is a toggle field without a styled box',
        styledBox: false
      })
    ]
  };

  readonly forgeCheckboxFieldConfig: FormConfig = {
    fields: [
      dbxForgeCheckboxField({
        key: 'checkbox',
        label: 'Check Me',
        description: 'this is a checkbox field'
      }),
      dbxForgeCheckboxField({
        key: 'requiredCheckbox',
        label: 'Required Check Me',
        description: 'this is a required checkbox field',
        required: true
      }),
      dbxForgeCheckboxField({
        key: 'readonlyCheckbox',
        label: 'Readonly Check Me',
        description: 'this is a readonly checkbox field',
        readonly: true
      }),
      dbxForgeCheckboxField({
        key: 'checkboxWrapperLabel',
        label: 'Wrapper notch',
        description: "showLabelAt: 'wrapper' — label appears in the notched outline.",
        showLabelAt: 'wrapper'
      }),
      dbxForgeCheckboxField({
        key: 'checkboxBothLabel',
        label: 'Both',
        description: "showLabelAt: 'both' — duplicates the label in the notch and inside the box.",
        showLabelAt: 'both'
      }),
      dbxForgeCheckboxField({
        key: 'checkboxContentLabel',
        label: 'Check Me',
        description: 'contentLabel — explicit secondary label inside the box.',
        showLabelAt: 'wrapper',
        contentLabel: 'Helper text rendered via contentLabel'
      })
    ]
  };

  readonly forgePhoneFieldsConfig: FormConfig = {
    fields: [dbxForgePhoneField({ key: 'phone' }) as any, dbxForgePhoneField({ key: 'phoneWithExtension', label: 'Phone Number With Optional Extension', description: 'This field supports optional extensions.', allowExtension: true }) as any, dbxForgePhoneField({ key: 'labeledPhone', label: 'Labeled Phone' }) as any]
  };
}
