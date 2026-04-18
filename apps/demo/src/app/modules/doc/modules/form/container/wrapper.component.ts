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
  forgeFlexLayout,
  forgeExpandWrapper,
  forgeToggleWrapper,
  forgeNameField,
  dbxForgeSectionWrapper,
  dbxForgeSubsectionWrapper,
  dbxForgeInfoWrapper,
  dbxForgeStyleWrapper,
  forgeTextIsAvailableField,
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

  readonly forgeFlexFieldConfig: FormConfig = {
    fields: [forgeFlexLayout([forgeCityField({}), forgeStateField({ hint: 'State Description' }), forgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })])]
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
    fields: [forgeFlexLayout([{ field: forgeCityField({}), size: 4 }, forgeStateField({}), forgeZipCodeField({})], { breakpoint: 'large', size: 1 })]
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
    fields: [forgeFlexLayout([{ field: forgeCityField({}), size: 4 }, forgeStateField({}), forgeZipCodeField({})], { breakpoint: 'large', breakToColumn: true, size: 1 })]
  };

  readonly flexFiveField: FormlyFieldConfig[] = [formlyFlexLayoutWrapper([formlyNameField(), formlyCityField(), formlyStateField(), formlyZipCodeField(), formlyCountryField()], { breakpoint: 'large', size: 1, relative: true })];

  readonly forgeFlexFiveFieldConfig: FormConfig = {
    fields: [forgeFlexLayout([forgeNameField({}), forgeCityField({}), forgeStateField({}), forgeZipCodeField({}), forgeCountryField({})], { breakpoint: 'large', size: 1, relative: true })]
  };

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
      forgeNameField({
        wrappers: [
          dbxForgeSectionWrapper({
            headerConfig: { header: 'Header', hint: 'Section Field Hint' }
          })
        ]
      }),
      forgeNameField({
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
      forgeNameField({
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
      forgeNameField({
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
      forgeNameField({
        wrappers: [
          dbxForgeInfoWrapper({
            onInfoClick: () => {
              // this.matDialog.open()
            }
          })
        ]
      }),
      forgeCityField({})
    ]
  };

  readonly forgeStyleFieldConfig: FormConfig = {
    fields: [
      forgeNameField({
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
      forgeTextIsAvailableField({
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
      forgeNumberSliderField({
        key: 'rating',
        label: 'Rating',
        description: 'Must be above 50.',
        min: 0,
        max: 100,
        validators: [{ type: 'custom', expression: 'fieldValue > 50', kind: 'minRating' }],
        validationMessages: { minRating: 'Rating must be above 50.' },
        props: { thumbLabel: true }
      }),
      forgeNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
    ]
  };
}
