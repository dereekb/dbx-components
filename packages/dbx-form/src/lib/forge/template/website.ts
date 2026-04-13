import { forgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';

/**
 * Configuration for a forge website URL text field.
 */
export interface DbxForgeWebsiteUrlFieldConfig extends Omit<DbxForgeTextFieldConfig, 'inputType' | 'key'>, Partial<Pick<DbxForgeTextFieldConfig, 'key'>> {}

/**
 * Creates a forge text field configured for website URL input.
 *
 * Defaults to the key `'website'` and label `'Website Url'` unless overridden in the config.
 *
 * Note: Unlike the formly equivalent, this does not yet include the `isWebsiteUrlValidator`
 * as @ng-forge/dynamic-forms uses a different validation system. URL pattern validation
 * should be applied through the forge form's validation configuration.
 *
 * @param config - Optional configuration for the website URL field
 * @returns A {@link MatInputField} for website URL input
 *
 * @example
 * ```typescript
 * const field = forgeWebsiteUrlField();
 * ```
 */
export function forgeWebsiteUrlField(config?: DbxForgeWebsiteUrlFieldConfig) {
  return forgeTextField({
    key: 'website',
    ...config,
    label: config?.label ?? 'Website Url',
    inputType: 'text'
  });
}
