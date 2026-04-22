import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  dbxForgeStyleWrapper,
  formlyRepeatArrayField,
  formlyNameField,
  formlyEmailField,
  formlyPhoneAndLabelSectionField,
  formlyAddressListField,
  formlyToggleField,
  dbxForgeArrayField,
  dbxForgeNameField,
  dbxForgeEmailField,
  dbxForgePhoneField,
  dbxForgeAddressGroup,
  dbxForgeToggleField,
  DbxFormFormlyArrayFieldModule,
  DbxFormFormlyTextFieldModule,
  DbxFormFormlyPhoneFieldModule,
  DbxFormFormlyBooleanFieldModule,
  DbxFormlyFieldsContextDirective,
  DbxFormSourceDirective,
  DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME,
  DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME
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
      dbxForgeArrayField({
        key: 'test',
        props: {
          label: 'Test Field',
          hint: 'This is a generic repeat field. It is configured with custom add/remove text, and a max of 2 items.',
          addText: 'Add Test Field',
          removeText: 'Remove Test Field'
        },
        template: [dbxForgeNameField()],
        maxLength: 2
      })
    ]
  };

  readonly forgeDragArrayAdvancedConfig: FormConfig = {
    fields: [
      dbxForgeArrayField({
        key: 'test2',
        props: {
          label: 'Field With Add, Remove, and Duplicate',
          hint: 'Shows the drag array field with dragging disabled, per-item labels, allowRemove driven by the item value, and a duplicate button that inserts a copy at the end of the list.',
          allowAdd: true
        },
        elementProps: {
          disableRearrange: true,
          allowRemove: ({ fieldValue }) => !(fieldValue as { disable: boolean })?.disable,
          labelForEntry: ({ fieldValue }) => (fieldValue as { name: string })?.name,
          // Returning a numeric index sends the duplicate to the end of the array
          // instead of inserting it directly after the source item.
          allowDuplicate: ({ arrayIndex, rootFormValue, arrayPath }) => {
            return Math.max(arrayIndex ? arrayIndex + 1 : 0, 0);
          },
          duplicateButton: {
            style: { type: 'stroked', color: 'accent' },
            display: { icon: 'content_copy', text: 'Make Copy' }
          }
        },
        template: [dbxForgeNameField(), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      })
    ]
  };
}
