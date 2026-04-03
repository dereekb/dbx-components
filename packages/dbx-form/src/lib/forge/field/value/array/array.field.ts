import type { ArrayAllowedChildren, SimplifiedArrayField, ArrayButtonConfig } from '@ng-forge/dynamic-forms';

// MARK: Repeat Array Field
/**
 * Configuration for a forge repeat array field that allows users to dynamically
 * add and remove groups of fields.
 */
export interface ForgeRepeatArrayFieldConfig {
  readonly key: string;
  /**
   * Template defining the structure of a single array item.
   *
   * - Single field (ArrayAllowedChildren) for primitive array items
   * - Array of fields (ArrayAllowedChildren[]) for object array items
   */
  readonly template: ArrayAllowedChildren | readonly ArrayAllowedChildren[];
  /**
   * Initial values for the array. Each element creates one array item.
   */
  readonly value?: readonly unknown[];
  /**
   * Minimum number of items required in the array.
   */
  readonly minLength?: number;
  /**
   * Maximum number of items allowed in the array.
   */
  readonly maxLength?: number;
  /**
   * Configuration for the add button, or false to disable it.
   */
  readonly addButton?: ArrayButtonConfig | false;
  /**
   * Configuration for the remove button on each item, or false to disable it.
   */
  readonly removeButton?: ArrayButtonConfig | false;
}

/**
 * Creates a forge field definition for a repeatable array of field groups.
 *
 * Uses the ng-forge SimplifiedArrayField with template-based item definitions
 * and auto-generated add/remove buttons.
 *
 * @param config - Repeat array configuration including the template and constraints
 * @returns A {@link SimplifiedArrayField}
 *
 * @example
 * ```typescript
 * const field = forgeRepeatArrayField({
 *   key: 'items',
 *   template: [
 *     forgeTextField({ key: 'name', label: 'Name' }),
 *     forgeNumberField({ key: 'quantity', label: 'Qty' })
 *   ],
 *   addButton: { label: 'Add Item' },
 *   removeButton: { label: 'Remove Item' }
 * });
 * ```
 */
export function forgeRepeatArrayField(config: ForgeRepeatArrayFieldConfig): SimplifiedArrayField {
  const { key, template, value, minLength, maxLength, addButton, removeButton } = config;

  const result: SimplifiedArrayField = {
    key,
    type: 'array' as const,
    template,
    ...(value != null && { value }),
    ...(minLength != null && { minLength }),
    ...(maxLength != null && { maxLength }),
    ...(addButton !== undefined && { addButton }),
    ...(removeButton !== undefined && { removeButton })
  };

  return result;
}
