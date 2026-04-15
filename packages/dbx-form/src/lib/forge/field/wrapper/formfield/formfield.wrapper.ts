import type { FieldDef, WrapperField, WrapperTypeDefinition } from '@ng-forge/dynamic-forms';
import { DbxForgeFieldFunctionDef, ExtractDbxForgeFieldDef } from '../../field';
import { dbxForgeWrapperFunctionFactory } from '../wrapper.field';

// MARK: Field Type
/**
 * Registered wrapper type name for the Material-style form-field wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains via {@link dbxForgeMaterialFormFieldWrappedFieldFunction}.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME = 'dbx-forge-form-field-wrapper' as const;

/**
 * Marker interface for a wrapper config that targets the form-field wrapper.
 */
export interface DbxForgeFormFieldWrapperFieldDef {
  readonly type: typeof DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME;
  test?: boolean;
}

/**
 * A {@link WrapperField} that wraps exactly one inner field `F` inside the
 * Material-style form-field wrapper (notched outline, floating label, hint/error subscript).
 *
 * Produced by {@link dbxForgeMaterialFormFieldWrappedFieldFunction} factory functions
 * such as {@link forgeNumberSliderField}.
 */
export interface DbxForgeFormFieldWrapperWrappedFieldDef<F> extends Omit<WrapperField, 'fields'> {
  readonly fields: [F];
}

/**
 * ng-forge {@link WrapperTypeDefinition} registration for the form-field wrapper.
 *
 * Lazy-loads {@link DbxForgeFormFieldWrapperComponent} which implements
 * {@link FieldWrapperContract} and injects {@link WRAPPER_FIELD_CONTEXT}
 * for its label, hint, and validation display.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_TYPE: WrapperTypeDefinition = {
  wrapperName: DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME,
  loadComponent: () => import('./formfield.wrapper.component').then((m) => m.DbxForgeFormFieldWrapperComponent)
};

// MARK: Config
/**
 * A forge field function that wraps its inner field in a
 * {@link DbxForgeFormFieldWrapperWrappedFieldDef} (Material form-field outline).
 */
export type DbxForgeMaterialFormFieldWrappedFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>> = (input: C) => DbxForgeFormFieldWrapperWrappedFieldDef<F>;

/**
 * Pre-configured {@link DbxForgeWrappedFieldFunctionFactory} that wraps any forge
 * field inside the Material form-field wrapper.
 *
 * Pass a {@link DbxForgeFieldFunctionConfig} to get back a field function whose
 * output is a {@link WrapperField} with the inner field nested inside a
 * `dbx-forge-form-field-wrapper` wrapper chain entry.
 *
 * The wrapper's {@link WrapperConfig} is built with label, hint, and className
 * forwarded from the forge field config so {@link DbxForgeFormFieldWrapperComponent}
 * can read them from {@link WRAPPER_FIELD_CONTEXT}.
 *
 * @example
 * ```ts
 * export const forgeNumberSliderField = dbxForgeMaterialFormFieldWrappedFieldFunction<DbxForgeNumberSliderFieldConfig>({
 *   type: 'slider',
 *   buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) => ({ step: config.step }))
 * });
 * ```
 */
export const dbxForgeMaterialFormFieldWrappedFieldFunction = dbxForgeWrapperFunctionFactory({
  buildWrappers: () =>
    [
      {
        type: DBX_FORGE_FORM_FIELD_WRAPPER_TYPE_NAME
      }
    ] as const
});
