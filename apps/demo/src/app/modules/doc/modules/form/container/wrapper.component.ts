import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  formlyExpandWrapper,
  formlyFlexLayoutWrapper,
  formlyInfoWrapper,
  formlyNameField,
  formlySectionWrapper,
  formlySubsectionWrapper,
  formlyToggleWrapper,
  formlyCityField,
  formlyStateField,
  formlyZipCodeField,
  formlyCountryField,
  formlyStyleWrapper,
  formlyToggleField,
  formlyTextIsAvailableField,
  forgeRow,
  forgeDbxSectionFieldWrapper,
  forgeDbxSubsectionFieldWrapper,
  forgeExpandWrapper,
  forgeToggleWrapper,
  forgeInfoFieldWrapper,
  forgeStyleWrapper,
  forgeNameField,
  forgeTextIsAvailableField,
  forgeNumberField,
  forgeNumberSliderField,
  formlyNumberSliderField,
  DbxFormFormlyNumberFieldModule,
  forgeCityField,
  forgeStateField,
  forgeZipCodeField,
  forgeCountryField,
  forgeToggleField,
  DbxFormFormlyWrapperModule,
  DbxFormFormlyBooleanFieldModule,
  DbxFormlyFieldsContextDirective,
  DbxFormFormlyTextFieldModule
} from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

@Component({
  templateUrl: './wrapper.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormFormlyWrapperModule, DbxFormFormlyTextFieldModule, DbxFormFormlyBooleanFieldModule, DbxFormFormlyNumberFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormWrapperComponent {
  readonly matDialog = inject(MatDialog);

  readonly expandField: FormlyFieldConfig[] = [
    formlyExpandWrapper(formlyNameField(), {
      expandLabel: 'Add Name',
      buttonType: 'button'
    })
  ];

  readonly toggleField: FormlyFieldConfig[] = [formlyToggleWrapper(formlyNameField())];

  readonly sectionField: FormlyFieldConfig[] = [
    formlySectionWrapper(formlyNameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    }),
    formlySectionWrapper(formlyNameField(), {
      h: 1,
      header: 'Header with star and configured size',
      icon: 'star',
      hint: 'Section Field Hint Inline',
      hintInline: true
    })
  ];

  readonly subsectionField: FormlyFieldConfig[] = [
    formlySubsectionWrapper(formlyNameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    })
  ];

  readonly infoField: FormlyFieldConfig[] = [
    formlyInfoWrapper(formlyNameField(), {
      onInfoClick: () => {
        // this.matDialog.open()
      }
    })
  ];

  readonly styleField: FormlyFieldConfig[] = [
    formlyStyleWrapper(formlyNameField(), {
      styleGetter: { background: 'rgba(255,0,0,0.3)', 'border-color': 'blue' },
      classGetter: 'dbx-content-border'
    })
  ];

  readonly flexField: FormlyFieldConfig[] = [
    formlyFlexLayoutWrapper([
      formlyCityField(),
      formlyStateField({
        description: 'State Description'
      }),
      formlyToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })
    ])
  ];

  readonly flexThreeField: FormlyFieldConfig[] = [
    formlyFlexLayoutWrapper(
      [
        {
          field: formlyCityField(),
          size: 4
        },
        formlyStateField(),
        formlyZipCodeField()
      ],
      { breakpoint: 'small', size: 1 }
    )
  ];

  readonly flexThreeFieldBreakToColumn: FormlyFieldConfig[] = [
    formlyFlexLayoutWrapper(
      [
        {
          field: formlyCityField(),
          size: 4
        },
        formlyStateField(),
        formlyZipCodeField()
      ],
      { breakpoint: 'large', breakToColumn: true, size: 1 }
    )
  ];

  readonly flexFiveField: FormlyFieldConfig[] = [formlyFlexLayoutWrapper([formlyNameField(), formlyCityField(), formlyStateField(), formlyZipCodeField(), formlyCountryField()], { breakpoint: 'large', size: 1, relative: true })];

  // Forge wrapper equivalents
  readonly forgeExpandFieldConfig: FormConfig = {
    fields: [
      forgeExpandWrapper({
        label: 'Add Name',
        buttonType: 'button',
        fields: [forgeNameField({})]
      })
    ]
  };

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      forgeToggleWrapper({
        fields: [forgeNameField({})]
      })
    ]
  };

  readonly forgeSectionFieldConfig: FormConfig = {
    fields: [
      forgeDbxSectionFieldWrapper({
        header: 'Header',
        hint: 'Section Field Hint',
        fields: [forgeNameField({})]
      }),
      forgeDbxSectionFieldWrapper({
        header: 'Header with star and configured size',
        h: 1,
        icon: 'star',
        hint: 'Section Field Hint Inline',
        hintInline: true,
        fields: [forgeNameField({ key: 'name2' })]
      })
    ]
  };

  readonly forgeSubsectionFieldConfig: FormConfig = {
    fields: [
      forgeDbxSubsectionFieldWrapper({
        header: 'Header',
        hint: 'Section Field Hint',
        fields: [forgeNameField({})]
      })
    ]
  };

  readonly forgeInfoFieldConfig: FormConfig = {
    fields: [
      forgeInfoFieldWrapper({
        onInfoClick: () => {
          // this.matDialog.open()
        },
        fields: [forgeNameField({})]
      })
    ]
  };

  readonly forgeInfoGroupFieldConfig: FormConfig = {
    fields: [
      forgeInfoFieldWrapper({
        onInfoClick: () => {
          // this.matDialog.open()
        },
        fields: [forgeNameField({}), forgeCityField({})]
      })
    ]
  };

  readonly forgeStyleFieldConfig: FormConfig = {
    fields: [
      forgeStyleWrapper({
        classGetter: 'dbx-content-border doc-style-wrapper-example',
        styleGetter: { background: 'rgba(255,0,0,0.3)', 'border-color': 'blue' },
        fields: [forgeNameField({})]
      })
    ]
  };

  readonly forgeFlexFieldConfig: FormConfig = {
    fields: [
      forgeRow({
        fields: [
          { ...forgeCityField({}), col: 4 },
          { ...forgeStateField({ description: 'State Description' }), col: 4 },
          { ...forgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' }), col: 4 }
        ]
      })
    ]
  };

  readonly forgeFlexThreeFieldConfig: FormConfig = {
    fields: [
      forgeRow({
        fields: [
          { ...forgeCityField({}), col: 8 },
          { ...forgeStateField({}), col: 2 },
          { ...forgeZipCodeField({}), col: 2 }
        ]
      })
    ]
  };

  readonly forgeFlexFiveFieldConfig: FormConfig = {
    fields: [
      forgeRow({
        fields: [
          { ...forgeNameField({}), col: 2 },
          { ...forgeCityField({}), col: 3 },
          { ...forgeStateField({}), col: 3 },
          { ...forgeZipCodeField({}), col: 2 },
          { ...forgeCountryField({}), col: 2 }
        ]
      })
    ]
  };

  readonly workingField: FormlyFieldConfig[] = [
    formlyTextIsAvailableField({
      key: 'username',
      label: 'Username',
      description: 'Type a value and wait — shows loading bar during async check. Type "taken" to see a validation error.',
      checkValueIsAvailable: (value: string) => {
        return new Observable<boolean>((subscriber) => {
          const timer = setTimeout(() => {
            subscriber.next(value !== 'taken');
            subscriber.complete();
          }, 2000);

          return () => clearTimeout(timer);
        });
      },
      isNotAvailableErrorMessage: 'This username is already taken.'
    })
  ];

  readonly forgeWorkingFieldConfig: FormConfig = (() => {
    const available = forgeTextIsAvailableField({
      key: 'username',
      label: 'Username',
      description: 'Type a value and wait — shows loading bar during async check. Type "taken" to see a validation error.',
      checkValueIsAvailable: (value: string) => {
        return new Observable<boolean>((subscriber) => {
          const timer = setTimeout(() => {
            subscriber.next(value !== 'taken');
            subscriber.complete();
          }, 2000);

          return () => clearTimeout(timer);
        });
      },
      isNotAvailableErrorMessage: 'This username is already taken.'
    });

    return {
      fields: [available.field],
      customFnConfig: { asyncValidators: available.asyncValidators },
      defaultValidationMessages: available.validationMessages
    };
  })();

  // Form-field wrapper demos
  readonly formFieldWrapperFields: FormlyFieldConfig[] = [
    formlyNameField({ required: true }),
    {
      ...formlyNumberSliderField({ key: 'rating', label: 'Rating', description: 'Must be above 50.', min: 0, max: 100 }),
      validators: { validation: [Validators.min(51)] },
      validation: { messages: { min: 'Rating must be above 50.' } }
    },
    formlyNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
  ];

  readonly forgeFormFieldWrapperSliderConfig: FormConfig = {
    fields: [
      /*
      forgeFormFieldWrapper({
        label: 'Rating',
        hint: 'Must be above 50.',
        fields: [
          {
            key: 'rating',
            type: 'slider',
            label: '',
            max: 100,
            validators: [{ type: 'custom', expression: 'fieldValue > 50', kind: 'minRating' }],
            validationMessages: { minRating: 'Rating must be above 50.' },
            props: { min: 0, max: 100, thumbLabel: true }
          } as any
        ]
      }),
      */
      forgeNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
    ]
  };

  readonly forgeFormFieldWrapperTextConfig: FormConfig = {
    fields: [
      // TODO: Add the
    ]
  };
}
