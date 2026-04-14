import type { FieldDef } from '@ng-forge/dynamic-forms';
import type { DbxForgeFormFieldWrapperFieldDef, DbxForgeFormFieldWrapperWrappedFieldProps } from './formfield.field';

/**
 * Extracts the inner field from a form-field wrapper.
 *
 * @param wrapperField - A wrapper field definition produced by a {@link DbxForgeMaterialFormFieldWrappedFieldFunction}
 * @returns The inner field definition
 */
export function getFormFieldWrapperInnerField<F extends FieldDef<any>>(wrapperField: DbxForgeFormFieldWrapperFieldDef<F>): F {
  return wrapperField.props.field;
}
