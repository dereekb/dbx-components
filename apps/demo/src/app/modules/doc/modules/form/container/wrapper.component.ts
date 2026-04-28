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
  dbxForgeFlexLayout,
  dbxForgeExpandWrapper,
  dbxForgeToggleWrapper,
  dbxForgeNameField,
  dbxForgeSectionWrapper,
  dbxForgeSubsectionWrapper,
  dbxForgeInfoWrapper,
  dbxForgeStyleWrapper,
  dbxForgeTextIsAvailableField,
  dbxForgeNumberSliderField,
  formlyNumberSliderField,
  DbxFormFormlyNumberFieldModule,
  dbxForgeCityField,
  dbxForgeStateField,
  dbxForgeZipCodeField,
  dbxForgeCountryField,
  dbxForgeToggleField,
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

  readonly forgeFlexFieldConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ fields: [dbxForgeCityField({}), dbxForgeStateField({ hint: 'State Description' }), dbxForgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })] })]
  };

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
      { breakpoint: 'large', size: 1 }
    )
  ];

  readonly forgeFlexThreeFieldConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ breakpoint: 'large', size: 1, fields: [{ field: dbxForgeCityField({}), size: 4 }, dbxForgeStateField({}), dbxForgeZipCodeField({})] })]
  };

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

  readonly forgeFlexThreeFieldBreakToColumnConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ breakpoint: 'large', breakToColumn: true, size: 1, fields: [{ field: dbxForgeCityField({}), size: 4 }, dbxForgeStateField({}), dbxForgeZipCodeField({})] })]
  };

  readonly flexFiveField: FormlyFieldConfig[] = [formlyFlexLayoutWrapper([formlyNameField(), formlyCityField(), formlyStateField(), formlyZipCodeField(), formlyCountryField()], { breakpoint: 'large', size: 1, relative: true })];

  readonly forgeFlexFiveFieldConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ breakpoint: 'large', size: 1, relative: true, fields: [dbxForgeNameField({}), dbxForgeCityField({}), dbxForgeStateField({}), dbxForgeZipCodeField({}), dbxForgeCountryField({})] })]
  };

  // Forge wrapper equivalents
  readonly forgeExpandFieldConfig: FormConfig = {
    fields: [
      dbxForgeExpandWrapper({
        label: 'Add Name',
        buttonType: 'button',
        fields: [dbxForgeNameField({})]
      })
    ]
  };

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      dbxForgeToggleWrapper({
        fields: [dbxForgeNameField({})]
      })
    ]
  };

  readonly forgeSectionFieldConfig: FormConfig = {
    fields: [
      dbxForgeNameField({
        wrappers: [
          dbxForgeSectionWrapper({
            headerConfig: { header: 'Header', hint: 'Section Field Hint' }
          })
        ]
      }),
      dbxForgeNameField({
        key: 'name2',
        wrappers: [
          dbxForgeSectionWrapper({
            headerConfig: { header: 'Header with star and configured size', h: 1, icon: 'star', hint: 'Section Field Hint Inline', hintInline: true }
          })
        ]
      })
    ]
  };

  readonly forgeSubsectionFieldConfig: FormConfig = {
    fields: [
      dbxForgeNameField({
        wrappers: [
          dbxForgeSubsectionWrapper({
            headerConfig: { header: 'Header', hint: 'Section Field Hint' }
          })
        ]
      })
    ]
  };

  readonly forgeInfoFieldConfig: FormConfig = {
    fields: [
      dbxForgeNameField({
        wrappers: [
          dbxForgeInfoWrapper({
            onInfoClick: () => {
              // this.matDialog.open()
            }
          })
        ]
      })
    ]
  };

  readonly forgeInfoGroupFieldConfig: FormConfig = {
    fields: [
      dbxForgeNameField({
        wrappers: [
          dbxForgeInfoWrapper({
            onInfoClick: () => {
              // this.matDialog.open()
            }
          })
        ]
      }),
      dbxForgeCityField({})
    ]
  };

  readonly forgeStyleFieldConfig: FormConfig = {
    fields: [
      dbxForgeNameField({
        wrappers: [
          dbxForgeStyleWrapper({
            classGetter: 'dbx-content-border doc-style-wrapper-example',
            styleGetter: { background: 'rgba(255,0,0,0.3)', 'border-color': 'blue' }
          })
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

  readonly forgeWorkingFieldConfig: FormConfig = {
    fields: [
      dbxForgeTextIsAvailableField({
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
    ]
  };

  // Form-field wrapper demos
  readonly formFieldWrapperFields: FormlyFieldConfig[] = [
    {
      ...formlyNumberSliderField({ key: 'rating', label: 'Rating', description: 'Must be above 50.', min: 0, max: 100 }),
      validators: { validation: [Validators.min(51)] },
      validation: { messages: { min: 'Rating must be above 50.' } }
    },
    formlyNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
  ];

  readonly forgeFormFieldWrapperSliderConfig: FormConfig = {
    fields: [
      dbxForgeNumberSliderField({
        key: 'rating',
        label: 'Rating',
        description: 'Must be above 50.',
        min: 0,
        max: 100,
        validators: [{ type: 'custom', expression: 'fieldValue > 50', kind: 'minRating' }],
        validationMessages: { minRating: 'Rating must be above 50.' },
        props: { thumbLabel: true }
      }),
      dbxForgeNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
    ]
  };
}
