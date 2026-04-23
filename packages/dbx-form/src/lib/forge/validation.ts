import type { ValidationMessages } from '@ng-forge/dynamic-forms';

/**
 * Default validation messages for all built-in Angular validators.
 *
 * Uses ng-forge's `{{param}}` interpolation for dynamic values.
 * Provides the same error messages as the formly validation configuration.
 *
 * Can be used as `FormConfig.defaultValidationMessages` to apply form-wide,
 * or spread into individual field `validationMessages`.
 *
 * @example
 * ```typescript
 * const config: FormConfig = {
 *   fields: [...],
 *   defaultValidationMessages: forgeDefaultValidationMessages()
 * };
 * ```
 *
 * @returns A ValidationMessages object with messages for required, email, minLength, maxLength, min, max, and pattern validators
 */
export function dbxForgeDefaultValidationMessages(): ValidationMessages {
  return {
    required: 'This field is required.',
    email: 'Invalid email address.',
    minLength: 'Should have at least {{requiredLength}} characters.',
    maxLength: 'This value should be less than {{requiredLength}} characters.',
    min: 'This value should be more than or equal to {{min}}.',
    max: 'This value should be less than or equal to {{max}}.',
    pattern: 'Invalid format.'
  };
}
