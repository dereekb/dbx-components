import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  formlyAddressField,
  formlyAddressListField,
  formlyCityField,
  formlyCountryField,
  formlyEmailField,
  formlyPhoneField,
  formlyNameField,
  formlyPhoneAndLabelSectionField,
  formlyWrappedPhoneAndLabelField,
  formlyStateField,
  formlyTextAreaField,
  formlyTextField,
  formlyZipCodeField,
  formlyPhoneListField,
  formlyToggleField,
  formlyCheckboxField,
  formlyNumberField,
  formlyLatLngTextField,
  formlyDollarAmountField,
  formlyNumberSliderField,
  dbxForgeTextField,
  dbxForgeTextAreaField,
  dbxForgeNumberField,
  dbxForgeNumberSliderField,
  dbxForgeDollarAmountField,
  dbxForgeToggleField,
  dbxForgeCheckboxField,
  dbxForgeNameField,
  dbxForgeEmailField,
  dbxForgeCityField,
  dbxForgeStateField,
  dbxForgeCountryField,
  dbxForgeZipCodeField,
  dbxForgePhoneField,
  dbxForgeAddressGroup,
  dbxForgeAddressListField,
  DbxFormFormlyTextFieldModule,
  DbxFormFormlyWrapperModule,
  DbxFormFormlyPhoneFieldModule,
  DbxFormFormlyBooleanFieldModule,
  DbxFormFormlyNumberFieldModule,
  DbxFormFormlyArrayFieldModule,
  DbxFormlyFieldsContextDirective,
  DbxFormSourceDirective,
  DbxActionFormDirective,
  dbxForgeValueSelectionField
} from '@dereekb/dbx-form';
import { addDays, startOfDay } from 'date-fns';
import { addSuffixFunction } from '@dereekb/util';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { of, delay } from 'rxjs';
import { dateTimezoneUtcNormal } from '@dereekb/date';
import { DbxContentContainerDirective, DbxButtonComponent, DbxErrorComponent, DbxActionErrorDirective } from '@dereekb/dbx-web';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionButtonDirective, DbxActionEnforceModifiedDirective } from '@dereekb/dbx-core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

@Component({
  templateUrl: './value.component.html',
  standalone: true,
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DocFeatureFormTabsComponent,
    DocFormExampleComponent,
    DocFormForgeExampleComponent,
    DbxFormlyFieldsContextDirective,
    DbxFormSourceDirective,
    DbxFormFormlyTextFieldModule,
    DbxFormFormlyWrapperModule,
    DbxFormFormlyArrayFieldModule,
    DbxFormFormlyPhoneFieldModule,
    DbxFormFormlyBooleanFieldModule,
    DbxFormFormlyNumberFieldModule,
    DbxActionDirective,
    DbxActionHandlerDirective,
    DbxActionFormDirective,
    DbxButtonComponent,
    DbxActionButtonDirective,
    DbxActionEnforceModifiedDirective,
    DbxErrorComponent,
    DbxActionErrorDirective
  ],
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

  readonly textFields: FormlyFieldConfig[] = [
    //
    formlyTextField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
    formlyTextField({ key: 'transform', label: 'Transformed Text Field', description: 'Text Field With String Transform Config. Adds _ between each letter as you type.', transform: { trim: true, transform: addSuffixFunction('_') } }),
    formlyNameField(),
    formlyEmailField(),
    formlyCityField(),
    formlyStateField(),
    formlyStateField({ label: 'State With Code Input', key: 'stateAsCode', asCode: true }),
    formlyCountryField(),
    formlyZipCodeField()
  ];

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

  readonly numberFields: FormlyFieldConfig[] = [
    //
    formlyNumberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
    formlyNumberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
    formlyNumberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
    formlyDollarAmountField({ key: 'dollars', label: 'formlyDollarAmountField()', description: 'Dollar amount field.' })
  ];

  readonly forgeNumberFieldsConfig: FormConfig = {
    fields: [
      dbxForgeNumberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
      dbxForgeNumberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
      dbxForgeNumberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
      dbxForgeDollarAmountField({ key: 'dollars', label: 'formlyDollarAmountField()', description: 'Dollar amount field.' })
    ]
  } as const satisfies FormConfig;

  readonly numberSliderFields: FormlyFieldConfig[] = [
    //
    formlyNumberSliderField({ key: 'test', label: 'formlyNumberSliderField()', description: 'A number between 0 and 100 picked with a slider.', placeholder: 'Placeholder', min: 0, max: 100 }),
    formlyNumberSliderField({ key: 'steptest', label: 'formlyNumberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, displayWith: (x) => `S${x / 5}` }),
    formlyNumberSliderField({ key: 'steptestcustomtickinterval', label: 'formlyNumberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, tickInterval: 5, invertSelectionColoring: true })
  ];

  readonly forgeNumberSliderFieldsConfig: FormConfig = {
    fields: [
      dbxForgeNumberSliderField({ key: 'test', label: 'dbxForgeNumberSliderField()', hint: 'A number between 0 and 100 picked with a slider.', min: 0, max: 100 }),
      dbxForgeNumberSliderField({ key: 'steptest', label: 'dbxForgeNumberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', min: 0, max: 100, step: 5 }),
      dbxForgeNumberSliderField({ key: 'steptestcustomtickinterval', label: 'dbxForgeNumberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', min: 0, max: 100, step: 5, tickInterval: 5 })
      // dbxForgeNumberSliderField({ key: 'validated', label: 'Validated Slider (must be > first slider)', description: 'Cross-field expression validator: value must be greater than the first slider.', min: 0, max: 100, validators: [{ type: 'custom' as const, expression: 'fieldValue > formValue.test', kind: 'mustBeGreaterThanTest' }], validationMessages: { mustBeGreaterThanTest: 'Value must be greater than the first slider' } })
    ]
  };

  readonly textAreaField: FormlyFieldConfig[] = [formlyTextAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })];

  readonly forgeTextAreaFieldConfig: FormConfig = {
    fields: [dbxForgeTextAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })]
  };

  readonly latLngTextField: FormlyFieldConfig[] = [formlyLatLngTextField()];

  readonly addressField: FormlyFieldConfig[] = [formlyAddressField()];

  readonly forgeAddressFieldConfig: FormConfig = {
    fields: [dbxForgeAddressGroup() as any]
  };

  readonly slimAddressField: FormlyFieldConfig[] = [formlyAddressField({ key: 'slim', hint: 'Line 2 and country are omitted.', stateField: { asCode: true }, includeLine2: false, includeCountry: false })];

  readonly forgeSlimAddressFieldConfig: FormConfig = {
    fields: [dbxForgeAddressGroup({ key: 'slim', stateField: { asCode: true }, includeLine2: false, includeCountry: false }) as any]
  };

  readonly addressListFields: FormlyFieldConfig[] = [formlyAddressListField()];

  readonly forgeAddressListFieldConfig: FormConfig = {
    fields: [dbxForgeAddressListField() as any]
  };

  readonly toggleField: FormlyFieldConfig[] = [
    formlyToggleField({
      key: 'toggle',
      label: 'Toggle Me',
      description: 'this is a toggle field'
    })
  ];

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      dbxForgeToggleField({
        key: 'toggle',
        label: 'Toggle Me',
        description: 'this is a toggle field'
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

  readonly checkboxField: FormlyFieldConfig[] = [
    formlyCheckboxField({
      key: 'checkbox',
      label: 'Check Me',
      description: 'this is a checkbox field'
    }),
    formlyCheckboxField({
      key: 'requiredCheckbox',
      label: 'Required Check Me',
      description: 'this is a required checkbox field',
      required: true
    }),
    formlyCheckboxField({
      key: 'readonlyCheckbox',
      label: 'Readonly Check Me',
      description: 'this is a readonly checkbox field',
      readonly: true
    })
  ];

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
      })
    ]
  };

  readonly phoneFields: FormlyFieldConfig[] = [
    formlyPhoneField(),
    formlyPhoneField({ key: 'phoneWithExtension', label: 'Phone Number With Optional Extension', description: 'This field supports optional extensions.', allowExtension: true }),
    formlyWrappedPhoneAndLabelField({
      phoneField: {
        key: 'labeledPhoneKey'
      }
    }),
    formlyPhoneAndLabelSectionField({
      key: 'section'
    })
  ];

  readonly forgePhoneFieldsConfig: FormConfig = {
    fields: [dbxForgePhoneField({ key: 'phone' }) as any, dbxForgePhoneField({ key: 'phoneWithExtension', label: 'Phone Number With Optional Extension', description: 'This field supports optional extensions.', allowExtension: true }) as any, dbxForgePhoneField({ key: 'labeledPhone', label: 'Labeled Phone' }) as any]
  };

  readonly phoneListField: FormlyFieldConfig[] = [formlyPhoneListField()];

  // -- Phone Dirty State Demo --
  readonly phoneDirtyStateFields: FormlyFieldConfig[] = [formlyNameField({ required: true }), formlyPhoneField()];

  // -- Phone Dirty State Demo --
  readonly phoneDirtyStateDefaultValue$ = of({
    name: 'Test User',
    phone: '+12025551234'
  });

  readonly handlePhoneDirtyStateAction: WorkUsingObservable<object> = () => {
    return of(true).pipe(delay(1000));
  };
}
