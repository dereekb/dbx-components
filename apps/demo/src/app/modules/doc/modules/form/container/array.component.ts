import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  formlyRepeatArrayField,
  formlyNameField,
  formlyEmailField,
  formlyPhoneAndLabelSectionField,
  formlyAddressListField,
  formlyToggleField,
  forgeArrayField,
  forgeNameField,
  forgeEmailField,
  forgePhoneAndLabelSectionField as forgePhoneAndLabelSection,
  forgeAddressListField,
  forgeToggleField,
  DbxFormFormlyArrayFieldModule,
  DbxFormFormlyTextFieldModule,
  DbxFormFormlyPhoneFieldModule,
  DbxFormFormlyBooleanFieldModule,
  DbxFormlyFieldsContextDirective,
  DbxFormSourceDirective
} from '@dereekb/dbx-form';
import { randomBoolean } from '@dereekb/util';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

@Component({
  templateUrl: './array.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormFormlyArrayFieldModule, DbxFormFormlyTextFieldModule, DbxFormFormlyPhoneFieldModule, DbxFormFormlyBooleanFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormArrayComponent {
  // -- Formly --
  readonly basicRepeatArrayField: FormlyFieldConfig[] = [
    formlyRepeatArrayField({
      key: 'test',
      label: 'Test Field',
      description: 'This is a generic repeat field. It is configured with custom add/remove text, and a max of 2 items.',
      addText: 'Add Test Field',
      removeText: 'Remove Test Field',
      repeatFieldGroup: [formlyNameField(), formlyEmailField(), formlyPhoneAndLabelSectionField(), formlyAddressListField()],
      maxLength: 2
    })
  ];

  readonly advancedRepeatArrayField: FormlyFieldConfig[] = [
    formlyRepeatArrayField<{ name: string; disable: boolean }>({
      key: 'test2',
      label: 'Field With Add and Remove Diabled Via Field',
      description: 'Shows the remove button being disabled when a value is a certain value, and shows the duplicate button.',
      duplicateText: 'Make Copy',
      repeatFieldGroup: [
        formlyNameField(),
        formlyToggleField({
          key: 'disable',
          label: 'Disable Remove'
        })
      ],
      addTemplate: (i) => ({ name: `New Item ${i}`, disable: randomBoolean() }),
      disableRearrange: true,
      allowAdd: true,
      allowDuplicate: true,
      allowRemove: ({ value }) => !(value as { disable: boolean })?.disable,
      labelForField: ({ value }) => (value as { name: string })?.name,
      addDuplicateToEnd: true
    })
  ];

  readonly advancedRepeatArrayValue = {
    test2: [
      {
        name: 'hello',
        disable: false
      },
      {
        name: 'start with disable=true',
        disable: true
      }
    ]
  };

  // -- Forge --
  readonly forgeDragArrayConfig: FormConfig = {
    fields: [
      forgeArrayField({
        key: 'test',
        label: 'Test Field',
        description: 'This is a generic repeat field. It is configured with custom add/remove text, and a max of 2 items.',
        template: [forgeNameField(), forgeEmailField(), forgePhoneAndLabelSection(), forgeAddressListField()],
        addText: 'Add Test Field',
        removeText: 'Remove Test Field',
        maxLength: 2
      }) as any
    ]
  };

  readonly forgeDragArrayAdvancedConfig: FormConfig = {
    fields: [
      forgeArrayField({
        key: 'test2',
        label: 'Field With Add and Remove',
        description: 'Shows the drag array field with duplicate, per-item labels, and rearrange disabled.',
        template: [forgeNameField(), forgeToggleField({ key: 'disable', label: 'Disable Remove' })],
        duplicateText: 'Make Copy',
        disableRearrange: true,
        allowAdd: true,
        allowDuplicate: true,
        labelForField: ({ value }) => (value as { name: string })?.name,
        addDuplicateToEnd: true
      }) as any
    ]
  };
}
