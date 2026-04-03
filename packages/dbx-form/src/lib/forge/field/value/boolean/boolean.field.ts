import type { MatToggleField, MatCheckboxField } from '@ng-forge/dynamic-forms-material';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Toggle Field
/**
 * Configuration for a forge Material toggle (slide toggle) field.
 */
export interface ForgeToggleFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  readonly defaultValue?: boolean;
}

/**
 * Creates a forge field definition for a Material slide toggle.
 *
 * Defaults to `false` when no default value is specified.
 *
 * @param config - Toggle field configuration
 * @returns A validated {@link MatToggleField} with type `'toggle'`
 *
 * @example
 * ```typescript
 * const field = forgeToggleField({ key: 'active', label: 'Active', defaultValue: true });
 * ```
 */
export function forgeToggleField(config: ForgeToggleFieldConfig): MatToggleField {
  const { key, label, required, readonly: isReadonly, description, defaultValue = false } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'toggle' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly
    }) as MatToggleField
  );
}

// MARK: Checkbox Field
/**
 * Configuration for a forge Material checkbox field.
 */
export interface ForgeCheckboxFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  readonly defaultValue?: boolean;
}

/**
 * Creates a forge field definition for a Material checkbox.
 *
 * Defaults to `false` when no default value is specified.
 *
 * @param config - Checkbox field configuration
 * @returns A validated {@link MatCheckboxField} with type `'checkbox'`
 *
 * @example
 * ```typescript
 * const field = forgeCheckboxField({ key: 'agree', label: 'I agree to the terms' });
 * ```
 */
export function forgeCheckboxField(config: ForgeCheckboxFieldConfig): MatCheckboxField {
  const { key, label, required, readonly: isReadonly, description, defaultValue = false } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'checkbox' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly
    }) as MatCheckboxField
  );
}
