import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxForgeArrayField, dbxForgeNameField, dbxForgeToggleField, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';

@Component({
  templateUrl: './array.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormArrayComponent {
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
          allowDuplicate: ({ arrayIndex }) => {
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
