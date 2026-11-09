import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { dbxForgeLayoutBoxesField, type DbxLayoutBoxesComponentConfig, DbxLayoutBoxesComponent, type DbxLayoutBoxesValue, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { DocFormLayoutBoxesItemComponent } from '../component/layoutboxes.example.item.component';
import { DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS, DOC_FORM_LAYOUT_BOXES_PEOPLE_CAP, DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL, type DocFormLayoutBoxData, docFormLayoutBoxesSampleValue, docFormLayoutBoxStyle } from '../component/layoutboxes.example';

const DOC_FORM_LAYOUT_BOXES_ITEM: DbxInjectionComponentConfig = { componentClass: DocFormLayoutBoxesItemComponent };

@Component({
  templateUrl: './layoutboxes.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DbxLayoutBoxesComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormLayoutBoxesComponent {
  readonly layoutBoxesValue = { boxes: docFormLayoutBoxesSampleValue() };

  readonly forgeLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Layout',
        hint: 'Drag a box to move it, drag a corner of the selected box to resize it, or use the arrow keys (Shift steps further, Alt resizes).',
        minLength: 1,
        props: {
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: DOC_FORM_LAYOUT_BOXES_ITEM,
          itemStyle: docFormLayoutBoxStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS,
          cap: DOC_FORM_LAYOUT_BOXES_PEOPLE_CAP
        }
      })
    ]
  };

  readonly forgeReadonlyLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Layout (readonly)',
        readonly: true,
        props: {
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: DOC_FORM_LAYOUT_BOXES_ITEM,
          itemStyle: docFormLayoutBoxStyle
        }
      })
    ]
  };

  readonly standaloneConfig: DbxLayoutBoxesComponentConfig<DocFormLayoutBoxData> = {
    canvas: { width: 4, height: 3 },
    item: DOC_FORM_LAYOUT_BOXES_ITEM,
    itemStyle: docFormLayoutBoxStyle,
    addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS,
    listPosition: 'below'
  };

  readonly standaloneValue = signal<Maybe<DbxLayoutBoxesValue<DocFormLayoutBoxData>>>(docFormLayoutBoxesSampleValue());
}
