import type { FieldDef } from '@ng-forge/dynamic-forms';
import type { DbxForgeFormFieldWrapperWrappedFieldDef } from './formfield.wrapper';

/**
 * Extracts the inner field from a form-field wrapper.
 *
 * @param wrapperField - A wrapper field definition produced by a {@link DbxForgeMaterialFormFieldWrappedFieldFunction}
 * @returns The inner field definition
 */
export function getDbxForgeFormFieldWrapperWrappedField<F extends FieldDef<any>>(wrapperField: DbxForgeFormFieldWrapperWrappedFieldDef<F>): F {
  return wrapperField.fields[0] as F;
}
