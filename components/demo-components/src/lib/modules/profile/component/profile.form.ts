import { type FieldValueIsAvailableValidatorFunction, textAreaField, textIsAvailableField } from '@dereekb/dbx-form';
import { PROFILE_BIO_MAX_LENGTH, PROFILE_USERNAME_MAX_LENGTH } from 'demo-firebase';

/**
 * Returns the default set of editable profile form fields (currently just the bio).
 *
 * @returns array of formly field configurations for profile editing
 */
export function profileFields() {
  return [profileBioField()];
}

/**
 * Returns the username field with async availability validation.
 *
 * @param config - provides the async validator to check username availability
 * @returns array containing the configured username field
 */
export function profileUsernameFields(config: ProfileUsernameFieldConfig) {
  return [profileUsernameField(config)];
}

/**
 * Creates a text area field for the user biography, enforcing the max length constraint.
 *
 * @returns a formly text area field configuration for the profile bio
 */
export function profileBioField() {
  return textAreaField({ key: 'bio', label: 'Biography', maxLength: PROFILE_BIO_MAX_LENGTH, required: true });
}

export interface ProfileUsernameFieldConfig {
  checkUsernameIsAvailable: FieldValueIsAvailableValidatorFunction<string>;
}

/**
 * Creates a username text field with throttled async availability checking.
 * Shows an error message when the username is already taken.
 *
 * @param config - provides the async validator to check username availability
 * @returns a formly text-is-available field configuration for the username
 */
export function profileUsernameField(config: ProfileUsernameFieldConfig) {
  return textIsAvailableField({
    key: 'username',
    label: 'Username',
    maxLength: PROFILE_USERNAME_MAX_LENGTH,
    required: true,
    throttle: 500,
    checkValueIsAvailable: config.checkUsernameIsAvailable,
    isNotAvailableErrorMessage: 'This username is already taken.'
  });
}
