import type { MatToggleField, MatCheckboxField, MatToggleProps, MatCheckboxProps } from '@ng-forge/dynamic-forms-material';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField, FORGE_STYLED_BOX_CLASS } from '../../field';

// MARK: Toggle Field
/**
 * Configuration for a forge Material toggle (slide toggle) field.
 */
export interface DbxForgeToggleFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  readonly defaultValue?: boolean;
  /**
   * Whether to render the toggle inside a styled outline box.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
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
export function forgeToggleField(config: DbxForgeToggleFieldConfig): MatToggleField {
  const { key, label, required, readonly: isReadonly, description, defaultValue = false, styledBox = true } = config;

  const props: MatToggleProps | undefined = description ? { hint: description } : undefined;
  const className = styledBox ? FORGE_STYLED_BOX_CLASS : undefined;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'toggle' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      props,
      className
    }) as MatToggleField
  );
}

// MARK: Checkbox Field
/**
 * Configuration for a forge Material checkbox field.
 */
export interface DbxForgeCheckboxFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
  readonly defaultValue?: boolean;
  /**
   * Whether to render the checkbox inside a styled outline box.
   *
   * Defaults to `true`.
   */
  readonly styledBox?: boolean;
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
export function forgeCheckboxField(config: DbxForgeCheckboxFieldConfig): MatCheckboxField {
  const { key, label, required, readonly: isReadonly, description, defaultValue = false, styledBox = true } = config;

  const props: MatCheckboxProps | undefined = description ? { hint: description } : undefined;
  const className = styledBox ? FORGE_STYLED_BOX_CLASS : undefined;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'checkbox' as const,
      label: label ?? '',
      value: defaultValue,
      required,
      readonly: isReadonly,
      props,
      className
    }) as MatCheckboxField
  );
}
