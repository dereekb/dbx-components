import type { FieldTypeDefinition, BaseValueField, FieldDef } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';
import type { ForgeWrapperFieldProps } from '../wrapper.field';

// MARK: Field Type
export const FORGE_FORM_FIELD_WRAPPER_TYPE_NAME = 'dbx-forge-form-field' as const;

/**
 * Props interface for the forge form-field wrapper.
 *
 * Provides the Material outlined form-field appearance (notched outline with floating label,
 * hint/error subscript) around child fields that cannot use `<mat-form-field>` directly
 * (e.g. `<mat-slider>`).
 */
export interface ForgeFormFieldWrapperProps extends ForgeWrapperFieldProps {
  /**
   * Optional hint text displayed in the subscript area below the outlined container.
   * When the child form has validation errors (and is touched), the first error message
   * takes precedence over the hint.
   */
  readonly hint?: string;
}

/**
 * Forge field definition for a form-field wrapper.
 */
export interface ForgeFormFieldWrapperFieldDef extends BaseValueField<ForgeFormFieldWrapperProps, Record<string, unknown>> {
  readonly type: typeof FORGE_FORM_FIELD_WRAPPER_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the form-field wrapper.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_TYPE: FieldTypeDefinition<ForgeFormFieldWrapperFieldDef> = {
  name: FORGE_FORM_FIELD_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./formfield.field.component').then((m) => m.ForgeFormFieldWrapperComponent),
  mapper: valueFieldMapper
};

// MARK: Config
/**
 * Configuration for creating a forge form-field wrapper.
 */
export interface ForgeFormFieldWrapperConfig {
  /**
   * Label text displayed in the notched outline.
   */
  readonly label?: string;
  /**
   * Hint text displayed in the subscript area below the outline.
   */
  readonly hint?: string;
  /**
   * Optional key override. Defaults to auto-generated `_formfield_N`.
   */
  readonly key?: string;
  /**
   * Child field definitions to render inside the outlined container.
   */
  readonly fields: FieldDef<unknown>[];
}

let _forgeFormFieldWrapperCounter = 0;

/**
 * Creates a forge form-field wrapper that renders child fields inside a Material-style
 * outlined container with a notched outline, floating label, and hint/error subscript.
 *
 * This is the forge equivalent of ngx-formly's `FormlyWrapperFormField` which wraps
 * fields in `<mat-form-field>`. Use it for fields that cannot be placed directly inside
 * `<mat-form-field>` (e.g. `<mat-slider>`).
 *
 * Uses `_` key prefix so `stripForgeInternalKeys` flattens child values into the parent form.
 *
 * @param config - Form-field wrapper configuration
 * @returns A {@link ForgeFormFieldWrapperFieldDef}
 *
 * @example
 * ```typescript
 * const wrappedSlider = forgeFormFieldWrapper({
 *   label: 'Rating',
 *   hint: 'Select a value between 0 and 10',
 *   fields: [
 *     { key: 'rating', type: 'slider', min: 0, max: 10 } as FieldDef<unknown>
 *   ]
 * });
 * ```
 */
export function forgeFormFieldWrapper(config: ForgeFormFieldWrapperConfig): ForgeFormFieldWrapperFieldDef {
  const { label, hint, fields, key } = config;

  return forgeField(
    filterFromPOJO({
      key: key ?? `_formfield_${_forgeFormFieldWrapperCounter++}`,
      type: FORGE_FORM_FIELD_WRAPPER_TYPE_NAME,
      label: label ?? '',
      value: {} as Record<string, unknown>,
      props: filterFromPOJO({
        hint,
        fields
      }) as ForgeFormFieldWrapperProps
    }) as ForgeFormFieldWrapperFieldDef
  );
}
