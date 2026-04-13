import type { FieldTypeDefinition, BaseValueField, FieldDef, LogicConfig, DynamicText } from '@ng-forge/dynamic-forms';
import { valueFieldMapper } from '@ng-forge/dynamic-forms/integration';
import { forgeField } from '../../field.util.meta';
import { DbxForgeWrapperFieldProps } from '../wrapper.field';
import { dbxForgeFieldFunction, DbxForgeFieldFunctionConfig, DbxForgeFieldFunctionDef, ExtractDbxForgeFieldDef } from '../../field';

// MARK: Field Type
export const FORGE_FORM_FIELD_WRAPPER_TYPE_NAME = 'dbx-forge-form-field' as const;

export interface DbxForgeFormFieldWrapperWrappedFieldProps {
  // TODO: Add other visual props
  readonly hint?: DynamicText;
}

/**
 * Props interface for the forge form-field wrapper.
 *
 * Provides the Material outlined form-field appearance (notched outline with floating label,
 * hint/error subscript) around child fields that cannot use `<mat-form-field>` directly
 * (e.g. `<mat-slider>`).
 */
export interface DbxForgeFormFieldWrapperProps<F extends FieldDef<DbxForgeFormFieldWrapperWrappedFieldProps> = FieldDef<DbxForgeFormFieldWrapperWrappedFieldProps>> extends DbxForgeWrapperFieldProps {
  /**
   * Child field definitions to render inside the wrapper.
   */
  readonly field: F;
}

/**
 * Forge field definition for a form-field wrapper.
 *
 * The phantom generic `TInner` carries the type of the wrapped inner field(s)
 * through the type system without affecting the runtime structure. This lets
 * factory functions like `forgeSearchableTextField` return a typed wrapper
 * (e.g. `DbxForgeFormFieldWrapperFieldDef<DbxForgeSearchableTextFieldDef<T,M,H>>`)
 * instead of an opaque `FieldDef<unknown>`.
 */
export interface DbxForgeFormFieldWrapperFieldDef<F extends FieldDef<DbxForgeFormFieldWrapperWrappedFieldProps> = FieldDef<DbxForgeFormFieldWrapperWrappedFieldProps>> extends BaseValueField<DbxForgeFormFieldWrapperProps<F>, Record<string, unknown>> {
  readonly type: typeof FORGE_FORM_FIELD_WRAPPER_TYPE_NAME;
}

/**
 * ng-forge FieldTypeDefinition for the form-field wrapper.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_TYPE: FieldTypeDefinition<DbxForgeFormFieldWrapperFieldDef> = {
  name: FORGE_FORM_FIELD_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./formfield.field.component').then((m) => m.DbxForgeFormFieldWrapperComponent),
  mapper: valueFieldMapper
};

// MARK: Config
let _forgeFormFieldWrapperCounter = 0;

export type DbxForgeMaterialFormFieldWrappedFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>> = (input: C) => DbxForgeFormFieldWrapperFieldDef<F>;

export function dbxForgeMaterialFormFieldWrappedFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>>(config: DbxForgeFieldFunctionConfig<C>): DbxForgeMaterialFormFieldWrappedFieldFunction<C, F> {
  const fn = dbxForgeFieldFunction<C, F>(config);

  return ((x: C) => {
    const field = fn(x as any) as F;

    // Create the wrapped field def
    const result: DbxForgeFormFieldWrapperFieldDef<F> = {
      key: `_form_field_${_forgeFormFieldWrapperCounter++}`,
      type: FORGE_FORM_FIELD_WRAPPER_TYPE_NAME,
      props: {
        field
      }
    };

    return result;
  }) as unknown as DbxForgeMaterialFormFieldWrappedFieldFunction<C, F>;
}
