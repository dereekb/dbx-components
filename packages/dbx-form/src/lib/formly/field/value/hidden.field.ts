import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type LabeledFieldConfig, formlyField } from '../field';

/**
 * Configuration for a hidden form field that is not visible to the user.
 */
export type HiddenFieldConfig = Pick<LabeledFieldConfig, 'key' | 'required'>;

/**
 * Creates a Formly field configuration for a hidden field with no visual representation.
 *
 * Useful for passing programmatic values through the form model without user interaction.
 *
 * @param config - Key and optional required flag
 * @param config.key - The form model key for this hidden field
 * @param config.required - Whether the hidden field must have a value; defaults to `false`
 * @returns A validated {@link FormlyFieldConfig} with no visible type
 *
 * @example
 * ```typescript
 * const field = hiddenField({ key: 'userId', required: true });
 * ```
 */
export function hiddenField({ key, required = false }: HiddenFieldConfig): FormlyFieldConfig {
  return formlyField({
    key,
    props: { required }
  });
}
