import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { dbxForgeLayoutBoxesField, type DbxLayoutBoxesComponentConfig, type DbxLayoutBoxesItemConfigFunction, DbxLayoutBoxesComponent, DbxLayoutBoxesCanvasComponent, type DbxLayoutBoxesValue, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { DocFormLayoutBoxesItemComponent } from '../component/layoutboxes.example.item.component';
import { DOC_FORM_LAYOUT_BOXES_PICK_LABELS, DOC_FORM_LAYOUT_BOXES_THING_LABELS, type DocFormLayoutBoxesPickItemData, DocFormLayoutBoxesPickItemComponent } from '../component/layoutboxes.example.pick.item.component';
import { DocFormLayoutBoxesPersonItemComponent } from '../component/layoutboxes.example.person.item.component';
import {
  DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS,
  DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS,
  DOC_FORM_LAYOUT_BOXES_CANVAS_PRESETS,
  DOC_FORM_LAYOUT_BOXES_PEOPLE_CAP,
  DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
  type DocFormLayoutBoxData,
  type DocFormLayoutBoxesCanvasPreset,
  docFormLayoutBoxesSampleValue,
  docFormLayoutBoxStyle,
  docFormLayoutBoxToneStyle
} from '../component/layoutboxes.example';

const DOC_FORM_LAYOUT_BOXES_ITEM: DbxInjectionComponentConfig = { componentClass: DocFormLayoutBoxesItemComponent };

const DOC_FORM_LAYOUT_BOXES_PICK_ITEM_DATA: DocFormLayoutBoxesPickItemData = { labels: DOC_FORM_LAYOUT_BOXES_PICK_LABELS };
const DOC_FORM_LAYOUT_BOXES_PICK_ITEM: DbxInjectionComponentConfig = { componentClass: DocFormLayoutBoxesPickItemComponent, data: DOC_FORM_LAYOUT_BOXES_PICK_ITEM_DATA };

const DOC_FORM_LAYOUT_BOXES_PERSON_ITEM: DbxInjectionComponentConfig = { componentClass: DocFormLayoutBoxesPersonItemComponent };
const DOC_FORM_LAYOUT_BOXES_THING_ITEM_DATA: DocFormLayoutBoxesPickItemData = { labels: DOC_FORM_LAYOUT_BOXES_THING_LABELS };
const DOC_FORM_LAYOUT_BOXES_THING_ITEM: DbxInjectionComponentConfig = { componentClass: DocFormLayoutBoxesPickItemComponent, data: DOC_FORM_LAYOUT_BOXES_THING_ITEM_DATA };

/**
 * Picks the row component by the box's kind. Returns the same constant per kind, so a row keeps its component until the
 * box changes kind.
 *
 * @param item - The box.
 * @returns The person row config for person boxes, otherwise the thing row config.
 */
const docFormLayoutBoxItemForKind: DbxLayoutBoxesItemConfigFunction<DocFormLayoutBoxData> = (item) => (item.data?.kind === 'person' ? DOC_FORM_LAYOUT_BOXES_PERSON_ITEM : DOC_FORM_LAYOUT_BOXES_THING_ITEM);

@Component({
  templateUrl: './2d.component.html',
  imports: [DbxContentContainerDirective, DbxButtonComponent, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent, DbxFormSourceDirective, DbxLayoutBoxesComponent, DbxLayoutBoxesCanvasComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocForm2dComponent {
  readonly layoutBoxesValue = { boxes: docFormLayoutBoxesSampleValue() };

  // MARK: Field
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

  readonly forgeMinimalLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Areas',
        hint: 'No canvas, picture or row component: a square canvas, and each row shows "Box N".',
        props: {
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS
        }
      })
    ]
  };

  // MARK: Runtime Canvas
  readonly canvasPresets = DOC_FORM_LAYOUT_BOXES_CANVAS_PRESETS;
  readonly canvasPreset = signal<DocFormLayoutBoxesCanvasPreset>(DOC_FORM_LAYOUT_BOXES_CANVAS_PRESETS[0]);
  readonly showPicture = signal<boolean>(true);

  readonly forgeRuntimeLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Layout',
        hint: 'The canvas and picture are Observables. Boxes are fractions of the canvas, so they stretch with it.',
        props: {
          canvas: toObservable(computed(() => this.canvasPreset().canvas)),
          imageUrl: toObservable(computed(() => (this.showPicture() ? DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL : undefined))),
          item: DOC_FORM_LAYOUT_BOXES_ITEM,
          itemStyle: docFormLayoutBoxStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS
        }
      })
    ]
  };

  // MARK: Limits
  readonly forgeLimitsLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Areas',
        hint: 'minLength: 1 and maxLength: 4 are validators. cap: { max: 3 } only warns, with the default warning text.',
        minLength: 1,
        maxLength: 4,
        props: {
          canvas: { width: 4, height: 3 },
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS,
          cap: { max: 3 }
        }
      })
    ]
  };

  // MARK: Shared Row Context
  readonly forgeSharedContextLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Labeled areas',
        hint: "The row config's data is injected into every row as DBX_INJECTION_COMPONENT_DATA. Here it carries the label list.",
        props: {
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: DOC_FORM_LAYOUT_BOXES_PICK_ITEM,
          itemStyle: docFormLayoutBoxStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS
        }
      })
    ]
  };

  // MARK: Row Component Per Box
  readonly forgePerBoxLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'People and things',
        hint: 'item is a function of the box: people get a name input, things pick from a list. Make thing changes the kind, and the row swaps its component.',
        props: {
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: docFormLayoutBoxItemForKind,
          itemStyle: docFormLayoutBoxStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS
        }
      })
    ]
  };

  // MARK: Styling
  readonly forgeStyledLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Custom tones',
        hint: 'itemStyle returns a CSS class per box that sets --dbx-layout-boxes-box-color. The wrapper overrides the other --dbx-layout-boxes-* tokens.',
        props: {
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: DOC_FORM_LAYOUT_BOXES_ITEM,
          itemStyle: docFormLayoutBoxToneStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS
        }
      })
    ]
  };

  // MARK: Unwrapped
  readonly forgeUnwrappedLayoutBoxesFieldConfig: FormConfig = {
    fields: [
      dbxForgeLayoutBoxesField<DocFormLayoutBoxData>({
        key: 'boxes',
        label: 'Not shown',
        props: {
          wrapped: false,
          canvas: { width: 16, height: 9 },
          imageUrl: DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL,
          item: DOC_FORM_LAYOUT_BOXES_ITEM,
          itemStyle: docFormLayoutBoxStyle,
          addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS,
          listPosition: 'below'
        }
      })
    ]
  };

  // MARK: Readonly
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

  // MARK: Standalone
  readonly standaloneConfig: DbxLayoutBoxesComponentConfig<DocFormLayoutBoxData> = {
    canvas: { width: 4, height: 3 },
    item: DOC_FORM_LAYOUT_BOXES_ITEM,
    itemStyle: docFormLayoutBoxStyle,
    addOptions: DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS,
    listPosition: 'below'
  };

  readonly standaloneValue = signal<Maybe<DbxLayoutBoxesValue<DocFormLayoutBoxData>>>(docFormLayoutBoxesSampleValue());

  readonly docFormLayoutBoxStyle = docFormLayoutBoxStyle;
}
