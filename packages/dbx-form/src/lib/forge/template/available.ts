// TODO: Implement forge text-is-available field.
// Requires async validation support in @ng-forge/dynamic-forms, which uses
// a different validation system than formly's asyncValidators.
//
// The formly equivalent wraps a textField with fieldValueIsAvailableValidator
// and a workingWrapper for loading indicator display.

import type { ForgeTextFieldConfig } from '../field/value/text/text.field';

/**
 * Configuration for a forge text field that includes an async availability check.
 *
 * Not yet implemented. Requires async validator support in @ng-forge/dynamic-forms.
 */
export interface ForgeTextAvailableFieldConfig extends ForgeTextFieldConfig {
  /**
   * Custom error message displayed when the value is not available.
   */
  readonly isNotAvailableErrorMessage?: string;
}

/**
 * Creates a forge text field with an async validator that checks whether the entered
 * value is available (e.g., for username availability checks).
 *
 * @throws Error - Not yet implemented. Requires async validator support.
 *
 * @example
 * ```typescript
 * // Future usage:
 * // const field = forgeTextIsAvailableField({
 * //   key: 'username',
 * //   label: 'Username',
 * //   isNotAvailableErrorMessage: 'Username is already taken'
 * // });
 * ```
 */
export function forgeTextIsAvailableField(_config: ForgeTextAvailableFieldConfig): never {
  throw new Error('forgeTextIsAvailableField is not yet implemented. Requires async validator support in @ng-forge/dynamic-forms.');
}
