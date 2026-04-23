import { dbxForgeWebsiteUrlValidator, type DbxForgeWebsiteUrlValidatorConfig } from '../field/field.util.validation';
import { dbxForgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';

/**
 * Configuration for a forge website URL text field.
 */
export interface DbxForgeWebsiteUrlFieldConfig extends Omit<DbxForgeTextFieldConfig, 'inputType' | 'key'>, Partial<Pick<DbxForgeTextFieldConfig, 'key'>>, DbxForgeWebsiteUrlValidatorConfig {}

/**
 * Creates a forge text field configured for website URL input, with website URL validation.
 *
 * Defaults to the key `'website'` and label `'Website Url'` unless overridden in the config.
 *
 * @param config - Optional configuration for the website URL field
 * @returns A {@link MatInputField} for website URL input
 *
 * @example
 * ```typescript
 * const field = dbxForgeWebsiteUrlField();
 * ```
 */
export function dbxForgeWebsiteUrlField(config?: DbxForgeWebsiteUrlFieldConfig) {
  return dbxForgeTextField(
    {
      key: 'website',
      ...config,
      label: config?.label ?? 'Website Url',
      inputType: 'text'
    },
    (x) => {
      x.addValidation(dbxForgeWebsiteUrlValidator(config));
    }
  );
}
