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
  forgeRow,
  forgeFlexRow,
  forgeSectionGroup,
  forgeSubsectionGroup,
  forgeExpandWrapper,
  forgeToggleWrapper,
  forgeInfoWrapper,
  forgeStyledGroup,
  forgeWithClassName,
  forgeNameField,
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
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormFormlyWrapperModule, DbxFormFormlyTextFieldModule, DbxFormFormlyBooleanFieldModule],
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
  } as unknown as FormConfig;

  readonly forgeToggleFieldConfig: FormConfig = {
    fields: [
      forgeToggleWrapper({
        label: 'Toggle',
        fields: [forgeNameField({})]
      })
    ]
  } as unknown as FormConfig;

  readonly forgeSectionFieldConfig: FormConfig = {
    fields: [
      forgeSectionGroup({
        header: 'Header',
        hint: 'Section Field Hint',
        fields: [forgeNameField({})]
      }),
      forgeSectionGroup({
        header: 'Header with star and configured size',
        h: 1,
        icon: 'star',
        hint: 'Section Field Hint Inline',
        fields: [forgeNameField({ key: 'name2' })]
      })
    ]
  } as unknown as FormConfig;

  readonly forgeSubsectionFieldConfig: FormConfig = {
    fields: [
      forgeSubsectionGroup({
        header: 'Header',
        hint: 'Section Field Hint',
        fields: [forgeNameField({})]
      })
    ]
  } as unknown as FormConfig;

  readonly forgeInfoFieldConfig: FormConfig = {
    fields: [
      forgeInfoWrapper({
        field: forgeNameField({}),
        onInfoClick: () => {
          // this.matDialog.open()
        }
      })
    ]
  } as unknown as FormConfig;

  readonly forgeStyleFieldConfig: FormConfig = {
    fields: [
      forgeStyledGroup({
        fields: [forgeNameField({})],
        className: 'dbx-content-border'
      })
    ]
  } as unknown as FormConfig;

  readonly forgeFlexFieldConfig: FormConfig = {
    fields: [
      forgeFlexRow({
        fields: [forgeCityField({}), forgeStateField({ description: 'State Description' }), forgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })]
      })
    ]
  } as unknown as FormConfig;

  readonly forgeFlexThreeFieldConfig: FormConfig = {
    fields: [
      forgeFlexRow({
        fields: [{ field: forgeCityField({}), size: 4 }, forgeStateField({}), forgeZipCodeField({})],
        defaultSize: 1
      })
    ]
  } as unknown as FormConfig;

  readonly forgeFlexFiveFieldConfig: FormConfig = {
    fields: [
      forgeFlexRow({
        fields: [forgeNameField({}), forgeCityField({}), forgeStateField({}), forgeZipCodeField({}), forgeCountryField({})],
        relative: true
      })
    ]
  } as unknown as FormConfig;
}
