import { DbxForgeFieldFunctionDef, DbxForgeFieldFunctionFieldDefBuilderFunctionInstance } from '../../field';

// MARK: Field Type
/**
 * Registered wrapper type name for the Material-style form-field wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains via {@link dbxForgeMaterialFormFieldWrappedFieldFunction}.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_NAME = 'dbx-forge-form-field-wrapper' as const;

/**
 * Marker interface for a wrapper config that targets the form-field wrapper.
 */
export interface DbxForgeFormFieldWrapperDef {
  readonly type: typeof DBX_FORGE_FORM_FIELD_WRAPPER_NAME;
}

export function configureDbxForgeFormFieldWrapper<C extends DbxForgeFieldFunctionDef<any>>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>): void {
  instance.addWrappers({
    type: DBX_FORGE_FORM_FIELD_WRAPPER_NAME
  });
}
