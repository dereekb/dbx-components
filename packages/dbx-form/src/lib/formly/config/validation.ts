import { FieldTypeConfig } from '@ngx-formly/core';
import { ValidationMessageOption } from '@ngx-formly/core/lib/models';

export function minLengthValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `Should have atleast ${field.props.minLength} characters.`;
}

export function maxLengthValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be less than ${field.props.maxLength} characters.`;
}

export function minValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be more than or equal to ${field.props.min}.`;
}

export function maxValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be less than or equal to ${field.props.max}.`;
}

export const REQUIRED_VALIDATION_MESSAGE = { name: 'required', message: 'This field is required.' };
export const MIN_LENGTH_VALIDATION_MESSAGE = { name: 'minLength', message: minLengthValidationMessage } as ValidationMessageOption;
export const MAX_LENGTH_VALIDATION_MESSAGE = { name: 'maxLength', message: maxLengthValidationMessage } as ValidationMessageOption;
export const MIN_VALIDATION_MESSAGE = { name: 'min', message: minValidationMessage } as ValidationMessageOption;
export const MAX_VALIDATION_MESSAGE = { name: 'max', message: maxValidationMessage } as ValidationMessageOption;
export const INVALID_PHONE_NUMBER_MESSAGE = { name: 'validatePhoneNumber', message: 'This is not a valid phone number.' };

export function defaultValidationMessages(): ValidationMessageOption[] {
  return [REQUIRED_VALIDATION_MESSAGE, MIN_LENGTH_VALIDATION_MESSAGE, MAX_LENGTH_VALIDATION_MESSAGE, MIN_VALIDATION_MESSAGE, MAX_VALIDATION_MESSAGE, INVALID_PHONE_NUMBER_MESSAGE];
}
