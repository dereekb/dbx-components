import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxForgeFlexLayout, dbxForgeExpandWrapper, dbxForgeToggleWrapper, dbxForgeNameField, dbxForgeSectionWrapper, dbxForgeSubsectionWrapper, dbxForgeInfoWrapper, dbxForgeStyleWrapper, dbxForgeTextIsAvailableField, dbxForgeNumberSliderField, dbxForgeCityField, dbxForgeStateField, dbxForgeZipCodeField, dbxForgeCountryField, dbxForgeToggleField } from '@dereekb/dbx-form';
import { Observable } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';

@Component({
  templateUrl: './wrapper.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormWrapperComponent {
  readonly forgeFlexFieldConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ fields: [dbxForgeCityField({}), dbxForgeStateField({ hint: 'State Description' }), dbxForgeToggleField({ key: 'toggle', label: 'Toggle', description: 'Toggle Description' })] })]
  };

  readonly forgeFlexThreeFieldConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ breakpoint: 'large', size: 1, fields: [{ field: dbxForgeCityField({}), size: 4 }, dbxForgeStateField({}), dbxForgeZipCodeField({})] })]
  };

  readonly forgeFlexThreeFieldBreakToColumnConfig: FormConfig = {
    fields: [dbxForgeFlexLayout({ breakpoint: 'large', breakToColumn: true, size: 1, fields: [{ field: dbxForgeCityField({}), size: 4 }, dbxForgeStateField({}), dbxForgeZipCodeField({})] })]
  };

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
