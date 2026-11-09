import { type MaybeObservableOrValue } from '@dereekb/rxjs';
import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { configureDbxForgeFormFieldWrapper } from '../../wrapper/formfield/formfield.wrapper';
import { type DbxForgeFieldFunctionDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, dbxForgeBuildFieldDef } from '../../field';
import type { DbxForgeField } from '../../../form/forge.form';
import { type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesValue } from '../../../../field/value/layoutboxes/layoutboxes';
import { type DbxLayoutBoxesComponentConfig } from '../../../../field/value/layoutboxes/layoutboxes.component';

// MARK: Field Type Name
/**
 * The custom forge field type name for the layout boxes field.
 */
export const FORGE_LAYOUT_BOXES_FIELD_TYPE = 'dbx-layout-boxes' as const;

// MARK: Props
/**
 * Props interface for the forge layout boxes field.
 *
 * Passed via the `props` property on the forge field definition. ng-forge keeps a field's props for the field's
 * lifetime, so only `canvas` and `imageUrl` can change at runtime, by passing an Observable.
 */
export interface DbxForgeLayoutBoxesFieldProps<T = unknown> extends Omit<DbxLayoutBoxesComponentConfig<T>, 'canvas' | 'imageUrl' | 'readonly'> {
  /**
   * The canvas the boxes are drawn on. Only its aspect ratio is used. Defaults to a square.
   *
   * May be an Observable, to change the canvas at runtime.
   */
  readonly canvas?: MaybeObservableOrValue<DbxLayoutBoxesCanvasSize>;
  /**
   * A picture drawn under the boxes, stretched to the canvas.
   *
   * May be an Observable, to change the picture at runtime.
   */
  readonly imageUrl?: MaybeObservableOrValue<string>;
  /**
   * Hint text shown below the field.
   */
  readonly hint?: string;
  /**
   * When `false`, render the editor bare without the surrounding dbx form-field outline (no label, hint or error
   * chrome). Defaults to `true`.
   */
  readonly wrapped?: boolean;
}

// MARK: Field Def
/**
 * Forge field definition interface for the layout boxes field.
 */
export interface DbxForgeLayoutBoxesFieldDef<T = unknown> extends BaseValueField<DbxForgeLayoutBoxesFieldProps<T>, DbxLayoutBoxesValue<T>> {
  readonly type: typeof FORGE_LAYOUT_BOXES_FIELD_TYPE;
}

// MARK: Layout Boxes Field
/**
 * Configuration for a forge layout boxes field.
 */
export interface DbxForgeLayoutBoxesFieldConfig<T = unknown> extends DbxForgeFieldFunctionDef<DbxForgeLayoutBoxesFieldDef<T>> {}

/**
 * Generic function type for {@link dbxForgeLayoutBoxesField} that preserves the payload type.
 */
export type DbxForgeLayoutBoxesFieldFunction = <T = unknown>(config: DbxForgeLayoutBoxesFieldConfig<T>) => DbxForgeField<DbxForgeLayoutBoxesFieldDef<T>>;

/**
 * Box-layout editor: a list of boxes drawn over a canvas (optionally over a picture), each a normalized rectangle plus a
 * consumer payload. Boxes can be moved, resized, nudged with the arrow keys, added and removed. A list beside the canvas
 * shows one row per box, rendered by the consumer's `item` component.
 *
 * - The `item` row component should extend {@link AbstractDbxLayoutBoxesItemDirective}.
 * - For "at least one box", use `minLength: 1`; `required` does not reject an empty list. For a hard limit, use
 *   `maxLength`. The `cap` prop only warns.
 * - The form output strips empty payload values (`''`, `null`, `undefined`), so make payload fields optional and default
 *   them when reading.
 * - The value defaults to `[]` when none is given.
 *
 * @param config - Layout boxes field configuration
 * @returns A {@link DbxForgeLayoutBoxesFieldDef}, wrapped in the dbx form-field wrapper unless `props.wrapped` is false
 *
 * @dbxFormField
 * @dbxFormSlug layout-boxes
 * @dbxFormTier field-factory
 * @dbxFormProduces DbxLayoutBoxItem<T>[]
 * @dbxFormArrayOutput yes
 * @dbxFormNgFormType dbx-layout-boxes
 * @dbxFormWrapperPattern material-form-field-wrapped
 * @dbxFormConfigInterface DbxForgeLayoutBoxesFieldConfig<T>
 * @dbxFormPropsInterface DbxForgeLayoutBoxesFieldProps<T>
 * @dbxFormGeneric <T = unknown>
 *
 * @example
 * ```typescript
 * dbxForgeLayoutBoxesField<MyBoxData>({
 *   key: 'boxes',
 *   label: 'Layout',
 *   minLength: 1,
 *   props: {
 *     canvas: { width: 16, height: 9 },
 *     item: { componentClass: MyBoxRowComponent },
 *     itemStyle: (item) => ({ color: item.data.kind === 'person' ? 'primary' : 'tertiary' }),
 *     addOptions: [{ text: 'Add box', icon: 'add_box', data: () => ({ kind: 'thing' }) }]
 *   }
 * })
 * ```
 */
export const dbxForgeLayoutBoxesField = dbxForgeFieldFunction<DbxForgeLayoutBoxesFieldConfig>({
  type: FORGE_LAYOUT_BOXES_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x, fieldDef) => {
    const props = x.getProps();

    // a fresh array per field, so the output always holds an array instead of a stripped ''
    if (fieldDef.value === undefined) {
      (fieldDef as { value?: unknown }).value = [];
    }

    if (props?.wrapped !== false) {
      x.configure(configureDbxForgeFormFieldWrapper);
    }
  })
}) as DbxForgeLayoutBoxesFieldFunction;
