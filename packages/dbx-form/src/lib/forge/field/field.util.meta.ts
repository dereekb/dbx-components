import type { FieldDef, FieldMeta } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type Maybe } from '@dereekb/util';
import { DbxForgeFieldFunctionDef, DbxForgeFieldFunctionFieldDefBuilderFunctionInstance } from './field';
import { FieldAutocompleteAttributeOptionRef, fieldAutocompleteAttributeValue } from '../../field/field.autocomplete';

/**
 * CSS class applied to forge fields when `styledBox` is enabled.
 *
 * Mirrors the Material outlined form-field appearance for fields that don't use `<mat-form-field>` (checkbox, toggle, slider).
 */
export const FORGE_STYLED_BOX_CLASS = 'dbx-forge-styled-box';

export function configureForgeAutocompleteFieldMeta<C extends DbxForgeFieldFunctionDef<any> & FieldAutocompleteAttributeOptionRef>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>): void {
  const fieldDef = instance.getFieldDef();

  if ('autocomplete' in fieldDef) {
    const meta = fieldAutocompleteAttributeValue(fieldDef['autocomplete']);

    if (meta) {
      instance.addMeta(meta as unknown as FieldMeta);
    }
  }
}

// MARK: REMOVE
/**
 * Validates the configuration on the input forge field definition.
 *
 * Ensures the field has a key set. Throws an error if the key is missing.
 *
 * @param fieldDef - The forge field definition to validate
 * @returns The validated field definition
 *
 * @example
 * ```typescript
 * const field = forgeField({ key: 'username', type: 'input', label: 'Username', value: '' });
 * ```
 *
 * @deprecated remove
 */
export function forgeField<T extends FieldDef<unknown>>(fieldDef: T): T {
  const filtered = filterFromPOJO(fieldDef) as T;

  if (!filtered.key) {
    console.error(filtered);
    throw new Error(`Field had a null key.`);
  }

  return filtered;
}
