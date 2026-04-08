import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  expandWrapper,
  flexLayoutWrapper,
  infoWrapper,
  nameField,
  sectionWrapper,
  subsectionWrapper,
  toggleWrapper,
  cityField,
  stateField,
  zipCodeField,
  countryField,
  styleWrapper,
  toggleField,
  forgeFlexRow,
  forgeDbxSectionFieldWrapper,
  forgeDbxSubsectionFieldWrapper,
  forgeExpandWrapper,
  forgeToggleWrapper,
  forgeInfoFieldWrapper,
  forgeStyleWrapper,
  forgeWorkingFieldWrapper,
  forgeFormFieldWrapper,
  forgeNameField,
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
    expandWrapper(nameField(), {
      expandLabel: 'Add Name',
      buttonType: 'button'
    })
  ];

  readonly toggleField: FormlyFieldConfig[] = [toggleWrapper(nameField())];

  readonly sectionField: FormlyFieldConfig[] = [
    sectionWrapper(nameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    }),
    sectionWrapper(nameField(), {
      h: 1,
      header: 'Header with star and configured size',
      icon: 'star',
      hint: 'Section Field Hint Inline',
      hintInline: true
    })
  ];

  readonly subsectionField: FormlyFieldConfig[] = [
    subsectionWrapper(nameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    })
  ];

  readonly infoField: FormlyFieldConfig[] = [
    infoWrapper(nameField(), {
      onInfoClick: () => {
        // this.matDialog.open()
      }
    })
  ];

  readonly styleField: FormlyFieldConfig[] = [
    styleWrapper(nameField(), {
      styleGetter: { background: 'rgba(255,0,0,0.3)', 'border-color': 'blue' },
      classGetter: 'dbx-content-border'
    })
  ];

  readonly flexField: FormlyFieldConfig[] = [
    flexLayoutWrapper([
      cityField(),
      stateField({
        description: 'State Description'
      }),
      toggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })
    ])
  ];

  readonly flexThreeField: FormlyFieldConfig[] = [
    flexLayoutWrapper(
      [
        {
          field: cityField(),
          size: 4
        },
        stateField(),
        zipCodeField()
      ],
      { breakpoint: 'small', size: 1 }
    )
  ];

  readonly flexThreeFieldBreakToColumn: FormlyFieldConfig[] = [
    flexLayoutWrapper(
      [
        {
          field: cityField(),
          size: 4
        },
        stateField(),
        zipCodeField()
      ],
      { breakpoint: 'large', breakToColumn: true, size: 1 }
    )
  ];

  readonly flexFiveField: FormlyFieldConfig[] = [flexLayoutWrapper([nameField(), cityField(), stateField(), zipCodeField(), countryField()], { breakpoint: 'large', size: 1, relative: true })];

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
      forgeFlexRow({
        fields: [forgeCityField({}), forgeStateField({ description: 'State Description' }), forgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })]
      })
    ]
  };

  readonly forgeFlexThreeFieldConfig: FormConfig = {
    fields: [
      forgeFlexRow({
        fields: [{ field: forgeCityField({}), size: 4 }, forgeStateField({}), forgeZipCodeField({})],
        defaultSize: 1
      })
    ]
  };

  readonly forgeFlexFiveFieldConfig: FormConfig = {
    fields: [
      forgeFlexRow({
        fields: [forgeNameField({}), forgeCityField({}), forgeStateField({}), forgeZipCodeField({}), forgeCountryField({})],
        relative: true
      })
    ]
  };

  readonly forgeWorkingFieldConfig: FormConfig = {
    fields: [
      forgeWorkingFieldWrapper({
        fields: [forgeNameField({})]
      })
    ]
  };

  // Form-field wrapper demos
  readonly formFieldWrapperFields: FormlyFieldConfig[] = [
    nameField({ required: true }),
    {
      ...formlyNumberSliderField({ key: 'rating', label: 'Rating', description: 'Must be above 50.', min: 0, max: 100 }),
      validators: { validation: [Validators.min(51)] },
      validation: { messages: { min: 'Rating must be above 50.' } }
    },
    formlyNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
  ];

  readonly forgeFormFieldWrapperSliderConfig: FormConfig = {
    fields: [
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
      forgeNumberSliderField({ key: 'volume', label: 'Volume', description: 'Pick a volume.', min: 0, max: 100, step: 5 })
    ]
  };

  readonly forgeFormFieldWrapperTextConfig: FormConfig = {
    fields: [
      forgeFormFieldWrapper({
        label: 'Wrapped Text Field',
        hint: 'A text field inside a form-field wrapper.',
        fields: [forgeNameField({ label: '' })]
      }),
      forgeFormFieldWrapper({
        label: 'Wrapped Number Field',
        hint: 'A number field inside a form-field wrapper.',
        fields: [forgeNumberField({ key: 'count', label: '', min: 0, max: 100 }) as any]
      })
    ]
  };
}
