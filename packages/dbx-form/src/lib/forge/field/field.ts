import type { FieldDef, FieldMeta } from '@ng-forge/dynamic-forms';
import type { Maybe } from '@dereekb/util';
import type { DisableAutocompleteForField } from '../../field';

/**
 * CSS class applied to forge fields when `styledBox` is enabled.
 *
 * Mirrors the Material outlined form-field appearance for fields that don't use `<mat-form-field>` (checkbox, toggle, slider).
 */
export const FORGE_STYLED_BOX_CLASS = 'dbx-forge-styled-box';

/**
 * Autocomplete configuration for a forge field.
 *
 * Pass a string for a specific autocomplete value (e.g., `'email'`, `'name'`),
 * or `false` to disable browser autofill.
 */
export type DbxForgeFieldAutocompleteConfig = string | DisableAutocompleteForField;

/**
 * Builds a {@link FieldMeta} object for the given autocomplete configuration.
 *
 * When `false`, disables browser autofill by setting `name: 'password'` and `autocomplete: 'off'`
 * (matching the Chrome autofill workaround). When a string, sets the `autocomplete` attribute
 * to that value.
 *
 * @param autocomplete - Autocomplete value or `false` to disable
 * @returns A meta object with autocomplete attributes, or `undefined` if not configured
 */
export function forgeAutocompleteFieldMeta(autocomplete: Maybe<DbxForgeFieldAutocompleteConfig>): FieldMeta | undefined {
  if (autocomplete == null) {
    return undefined;
  }

  if (autocomplete === false) {
    // https://stackoverflow.com/questions/15738259/disabling-chrome-autofill
    return {
      name: 'password',
      autocomplete: 'off'
    };
  }

  return {
    autocomplete
  };
}

/**
 * Merges autocomplete configuration into an existing {@link FieldMeta} object.
 *
 * @param baseMeta - Existing meta to merge with (e.g., step metadata on number fields)
 * @param autocomplete - Autocomplete configuration to merge
 * @returns Merged meta, or `undefined` if neither input provides values
 */
export function mergeForgeFieldMeta(baseMeta: Maybe<FieldMeta>, autocomplete: Maybe<DbxForgeFieldAutocompleteConfig>): FieldMeta | undefined {
  const autocompleteMeta = forgeAutocompleteFieldMeta(autocomplete);

  if (baseMeta && autocompleteMeta) {
    return { ...baseMeta, ...autocompleteMeta };
  }

  return autocompleteMeta ?? baseMeta ?? undefined;
}

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
 */
export function forgeField<T extends FieldDef<unknown>>(fieldDef: T): T {
  if (!fieldDef.key) {
    console.error(fieldDef);
    throw new Error(`Field had a null key.`);
  }

  return fieldDef;
}
