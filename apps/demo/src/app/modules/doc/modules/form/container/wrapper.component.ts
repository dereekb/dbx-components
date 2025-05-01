import { MatDialog } from '@angular/material/dialog';
import { Component, inject } from '@angular/core';
import { expandWrapper, flexLayoutWrapper, infoWrapper, nameField, sectionWrapper, subsectionWrapper, toggleWrapper, cityField, stateField, zipCodeField, countryField, styleWrapper, toggleField, DbxFormFormlyWrapperModule, DbxFormFormlyBooleanFieldModule, DbxFormlyFieldsContextDirective, DbxFormFormlyTextFieldModule } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';

@Component({
  templateUrl: './wrapper.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormFormlyWrapperModule, DbxFormFormlyTextFieldModule, DbxFormFormlyBooleanFieldModule]
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
}
