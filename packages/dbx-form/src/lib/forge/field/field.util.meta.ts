import type { FieldMeta } from '@ng-forge/dynamic-forms';
import { DbxForgeFieldFunctionDef, DbxForgeFieldFunctionFieldDefBuilderFunctionInstance } from './field';
import { FieldAutocompleteAttributeOptionRef, fieldAutocompleteAttributeValue } from '../../field/field.autocomplete';

/**
 * Reads the `autocomplete` option from the builder's field def and, when it resolves to a
 * recognized HTML autocomplete token, attaches it to the field as `FieldMeta` so the
 * rendered input emits the corresponding `autocomplete` attribute.
 *
 * Intended to be used inside a field builder function to propagate autocomplete hints from
 * config into the final rendered form control.
 *
 * @param instance - the field builder instance whose field def is inspected and to which metadata is added
 */
export function configureForgeAutocompleteFieldMeta<C extends DbxForgeFieldFunctionDef<any> & FieldAutocompleteAttributeOptionRef>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>): void {
  const fieldDef = instance.getFieldDef();

  if ('autocomplete' in fieldDef) {
    const meta = fieldAutocompleteAttributeValue(fieldDef['autocomplete']);

    if (meta) {
      instance.addMeta(meta as unknown as FieldMeta);
    }
  }
}
