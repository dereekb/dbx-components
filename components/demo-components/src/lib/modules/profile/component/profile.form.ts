import { FieldValueIsAvailableValidatorFunction, textAreaField, textField, textIsAvailableField } from "@dereekb/dbx-form";
import { PROFILE_BIO_MAX_LENGTH, PROFILE_USERNAME_MAX_LENGTH } from "@dereekb/demo-firebase";

export function profileFields() {
  return [
    profileBioField()
  ];
}

export function profileUsernameFields(config: ProfileUsernameFieldConfig) {
  return [
    profileUsernameField(config)
  ];
}

export function profileBioField() {
  return textAreaField({ key: 'bio', label: 'Biography', maxLength: PROFILE_BIO_MAX_LENGTH, required: true });
}

export interface ProfileUsernameFieldConfig {
  checkUsernameIsAvailable: FieldValueIsAvailableValidatorFunction<string>;
}

export function profileUsernameField(config: ProfileUsernameFieldConfig) {
  return textIsAvailableField({
    key: 'username', label: 'Username', maxLength: PROFILE_USERNAME_MAX_LENGTH, required: true,
    throttle: 500,
    checkValueIsAvailable: config.checkUsernameIsAvailable,
    isNotAvailableErrorMessage: 'This username is already taken.'
  });
}
