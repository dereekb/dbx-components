import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { filterFromPOJO } from '@dereekb/util';
import { forgeField } from '../../field';

// MARK: Hidden Field
/**
 * Configuration for a forge hidden form field that is not visible to the user.
 */
export interface DbxForgeHiddenFieldConfig {
  readonly key: string;
  readonly required?: boolean;
  readonly defaultValue?: unknown;
}

/**
 * Creates a forge field definition for a hidden field with no visual representation.
 *
 * Useful for passing programmatic values through the form model without user interaction.
 *
 * @param config - Key, optional required flag, and optional default value
 * @returns A validated forge field definition with `hidden` set to `true`
 *
 * @example
 * ```typescript
 * const field = forgeHiddenField({ key: 'userId', required: true });
 * ```
 */
export function forgeHiddenField(config: DbxForgeHiddenFieldConfig): MatInputField {
  const { key, required, defaultValue = '' } = config;

  return forgeField(
    filterFromPOJO({
      key,
      type: 'input' as const,
      label: '',
      value: defaultValue,
      required,
      hidden: true
    }) as MatInputField
  );
}
