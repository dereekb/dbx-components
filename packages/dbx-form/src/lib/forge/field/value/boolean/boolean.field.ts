import type { MatToggleField, MatCheckboxField, MatToggleProps, MatCheckboxProps } from '@ng-forge/dynamic-forms-material';
import { forgeField, FORGE_STYLED_BOX_CLASS } from '../../field';
import type { DbxForgeFieldConfig } from '../../field.type';

// MARK: Toggle Field
/**
 * Configuration for a forge Material toggle (slide toggle) field.
 */
export interface DbxForgeToggleFieldConfig extends DbxForgeFieldConfig {
  readonly label?: string;
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
  const { key, label, required, readonly: isReadonly, description, defaultValue = false, styledBox = true, logic } = config;

  const props: MatToggleProps | undefined = description ? { hint: description } : undefined;
  const className = styledBox ? FORGE_STYLED_BOX_CLASS : undefined;

  return forgeField({
    key,
    type: 'toggle' as const,
    label: label ?? '',
    value: defaultValue,
    required,
    readonly: isReadonly,
    logic,
    props,
    className
  } as MatToggleField);
}

// MARK: Checkbox Field
/**
 * Configuration for a forge Material checkbox field.
 */
export interface DbxForgeCheckboxFieldConfig extends DbxForgeFieldConfig {
  readonly label?: string;
  readonly placeholder?: string;
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
  const { key, label, required, readonly: isReadonly, description, defaultValue = false, styledBox = true, logic } = config;

  const props: MatCheckboxProps | undefined = description ? { hint: description } : undefined;
  const className = styledBox ? FORGE_STYLED_BOX_CLASS : undefined;

  return forgeField({
    key,
    type: 'checkbox' as const,
    label: label ?? '',
    value: defaultValue,
    required,
    readonly: isReadonly,
    logic,
    props,
    className
  } as MatCheckboxField);
}
