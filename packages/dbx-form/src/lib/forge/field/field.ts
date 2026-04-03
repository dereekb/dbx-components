import type { FieldDef } from '@ng-forge/dynamic-forms';

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
