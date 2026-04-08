import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  addressField,
  addressListField,
  cityField,
  countryField,
  emailField,
  phoneField,
  nameField,
  phoneAndLabelSectionField,
  wrappedPhoneAndLabelField,
  stateField,
  textAreaField,
  textField,
  zipCodeField,
  phoneListField,
  toggleField,
  checkboxField,
  numberField,
  latLngTextField,
  dollarAmountField,
  numberSliderField,
  forgeTextField,
  forgeTextAreaField,
  forgeNumberField,
  forgeNumberSliderField,
  forgeDollarAmountField,
  forgeToggleField,
  forgeCheckboxField,
  forgeNameField,
  forgeEmailField,
  forgeCityField,
  forgeStateField,
  forgeCountryField,
  forgeZipCodeField,
  forgePhoneField,
  forgeWrappedPhoneAndLabelField,
  forgePhoneAndLabelSectionField,
  forgeAddressField,
  forgeAddressListField,
  DbxFormFormlyTextFieldModule,
  DbxFormFormlyWrapperModule,
  DbxFormFormlyPhoneFieldModule,
  DbxFormFormlyBooleanFieldModule,
  DbxFormFormlyNumberFieldModule,
  DbxFormFormlyArrayFieldModule,
  DbxFormlyFieldsContextDirective,
  DbxFormSourceDirective,
  DbxActionFormDirective
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

  readonly forgeTextFieldsConfig: FormConfig = {
    fields: [
      forgeTextField({ key: 'test', label: 'Text Field', description: 'A required text field.', placeholder: 'Placeholder', required: true, minLength: 4, maxLength: 15 }),
      forgeTextField({ key: 'transform', label: 'Transformed Text Field', description: 'Text Field With String Transform Config.', transform: { trim: true } }),
      forgeNameField(),
      forgeEmailField(),
      forgeCityField(),
      forgeStateField(),
      forgeStateField({ label: 'State With Code Input', key: 'stateAsCode', asCode: true }),
      forgeCountryField(),
      forgeZipCodeField()
    ]
  };

  readonly numberFields: FormlyFieldConfig[] = [
    //
    numberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
    numberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
    numberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5, enforceStep: true }),
    dollarAmountField({ key: 'dollars', label: 'dollarAmountField()', description: 'Dollar amount field.' })
  ];

  readonly forgeNumberFieldsConfig: FormConfig = {
    fields: [
      forgeNumberField({ key: 'test', label: 'Number Field', description: 'A number between 0 and 100.', placeholder: 'Placeholder', min: 0, max: 100 }),
      forgeNumberField({ key: 'steptest', label: 'Number Field With Step', description: 'Any number, but increases in steps of 5.', step: 5 }),
      forgeNumberField({ key: 'enforcedsteptest', label: 'Number Divisible by 5', description: 'Any number divisible by 5.', step: 5 }),
      forgeDollarAmountField({ key: 'dollars', label: 'forgeDollarAmountField()', description: 'Dollar amount field.' })
    ]
  };

  readonly numberSliderFields: FormlyFieldConfig[] = [
    //
    numberSliderField({ key: 'test', label: 'numberSliderField()', description: 'A number between 0 and 100 picked with a slider.', placeholder: 'Placeholder', min: 0, max: 100 }),
    numberSliderField({ key: 'steptest', label: 'numberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, displayWith: (x) => `S${x / 5}` }),
    numberSliderField({ key: 'steptestcustomtickinterval', label: 'numberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', placeholder: 'Placeholder', min: 0, max: 100, step: 5, tickInterval: 5, invertSelectionColoring: true })
  ];

  readonly forgeNumberSliderFieldsConfig: FormConfig = {
    fields: [
      forgeNumberSliderField({ key: 'test', label: 'forgeNumberSliderField()', description: 'A number between 0 and 100 picked with a slider.', min: 0, max: 100 }),
      forgeNumberSliderField({ key: 'steptest', label: 'forgeNumberSliderField() with Steps', description: 'A number between 0 and 100 picked with a slider with steps of 5.', min: 0, max: 100, step: 5 }),
      forgeNumberSliderField({ key: 'steptestcustomtickinterval', label: 'forgeNumberSliderField() with Steps and Custom Tick Interval', description: 'A number between 0 and 100 picked with a slider with steps of 5 and tick interval of 5.', min: 0, max: 100, step: 5, tickInterval: 5 })
    ]
  };

  readonly textAreaField: FormlyFieldConfig[] = [textAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })];

  readonly forgeTextAreaFieldConfig: FormConfig = {
    fields: [forgeTextAreaField({ key: 'test', label: 'Text Area Field', description: 'A required text area field.', placeholder: 'Placeholder', required: true })]
  };

  readonly latLngTextField: FormlyFieldConfig[] = [latLngTextField()];

  readonly addressField: FormlyFieldConfig[] = [addressField()];

  readonly forgeAddressFieldConfig: FormConfig = {
    fields: [forgeAddressField() as any]
  };

  readonly slimAddressField: FormlyFieldConfig[] = [addressField({ key: 'slim', hint: 'Line 2 and country are omitted.', stateField: { asCode: true }, includeLine2: false, includeCountry: false })];

  readonly forgeSlimAddressFieldConfig: FormConfig = {
    fields: [forgeAddressField({ key: 'slim', hint: 'Line 2 and country are omitted.', stateField: { asCode: true }, includeLine2: false, includeCountry: false }) as any]
  };

  readonly addressListFields: FormlyFieldConfig[] = [addressListField()];

  readonly forgeAddressListFieldConfig: FormConfig = {
    fields: [forgeAddressListField() as any]
  };

  readonly toggleField: FormlyFieldConfig[] = [
    toggleField({
      key: 'toggle',
      label: 'Toggle Me',
      description: 'this is a toggle field'
    })
  ];

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      forgeToggleField({
        key: 'toggle',
        label: 'Toggle Me',
        description: 'this is a toggle field'
      })
    ]
  };

  readonly forgeToggleNoBoxFieldConfig: FormConfig = {
    fields: [
      forgeToggleField({
        key: 'toggle',
        label: 'Toggle Me',
        description: 'this is a toggle field without a styled box',
        styledBox: false
      })
    ]
  };

  readonly checkboxField: FormlyFieldConfig[] = [
    checkboxField({
      key: 'checkbox',
      label: 'Check Me',
      description: 'this is a checkbox field'
    })
  ];

  readonly forgeCheckboxFieldConfig: FormConfig = {
    fields: [
      forgeCheckboxField({
        key: 'checkbox',
        label: 'Check Me',
        description: 'this is a checkbox field'
      })
    ]
  };

  readonly phoneFields: FormlyFieldConfig[] = [
    phoneField(),
    phoneField({ key: 'phoneWithExtension', label: 'Phone Number With Optional Extension', description: 'This field supports optional extensions.', allowExtension: true }),
    wrappedPhoneAndLabelField({
      phoneField: {
        key: 'labeledPhoneKey'
      }
    }),
    phoneAndLabelSectionField({
      key: 'section'
    })
  ];

  readonly forgePhoneFieldsConfig: FormConfig = {
    fields: [
      forgePhoneField({ key: 'phone' }) as any,
      forgePhoneField({ key: 'phoneWithExtension', label: 'Phone Number With Optional Extension', description: 'This field supports optional extensions.', allowExtension: true }) as any,
      forgeWrappedPhoneAndLabelField({
        phoneField: {
          key: 'labeledPhoneKey'
        },
        labelField: {
          key: 'labeledPhoneLabel'
        }
      }) as any,
      forgePhoneAndLabelSectionField({
        key: 'section',
        phoneField: {
          key: 'sectionPhone'
        },
        labelField: {
          key: 'sectionLabel'
        }
      }) as any
    ]
  };

  readonly phoneListField: FormlyFieldConfig[] = [phoneListField()];

  // -- Phone Dirty State Demo --
  readonly phoneDirtyStateFields: FormlyFieldConfig[] = [nameField({ required: true }), phoneField()];

  readonly phoneDirtyStateDefaultValue$ = of({
    name: 'Test User',
    phone: '+12025551234'
  });

  readonly handlePhoneDirtyStateAction: WorkUsingObservable<object> = () => {
    return of(true).pipe(delay(1000));
  };
}
