import { type FieldTypeConfig } from '@ngx-formly/core';
import { type ValidationMessageOption } from '../type';

/**
 * Returns a validation message indicating the minimum character length was not met.
 *
 * @param err - The validation error object.
 * @param field - The Formly field configuration containing `minLength` in its props.
 * @returns A human-readable validation message string.
 */
export function minLengthValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `Should have atleast ${field.props.minLength} characters.`;
}

/**
 * Returns a validation message indicating the maximum character length was exceeded.
 *
 * @param err - The validation error object.
 * @param field - The Formly field configuration containing `maxLength` in its props.
 * @returns A human-readable validation message string.
 */
export function maxLengthValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be less than ${field.props.maxLength} characters.`;
}

/**
 * Returns a validation message indicating the value is below the minimum allowed.
 *
 * @param err - The validation error object.
 * @param field - The Formly field configuration containing `min` in its props.
 * @returns A human-readable validation message string.
 */
export function minValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be more than or equal to ${field.props.min}.`;
}

/**
 * Returns a validation message indicating the value exceeds the maximum allowed.
 *
 * @param err - The validation error object.
 * @param field - The Formly field configuration containing `max` in its props.
 * @returns A human-readable validation message string.
 */
export function maxValidationMessage(err: unknown, field: FieldTypeConfig) {
  return `This value should be less than or equal to ${field.props.max}.`;
}

/**
 * Validation message option for required fields.
 */
export const REQUIRED_VALIDATION_MESSAGE = { name: 'required', message: 'This field is required.' };

/**
 * Validation message option for minimum length violations.
 */
export const MIN_LENGTH_VALIDATION_MESSAGE = { name: 'minLength', message: minLengthValidationMessage } as ValidationMessageOption;

/**
 * Validation message option for maximum length violations.
 */
export const MAX_LENGTH_VALIDATION_MESSAGE = { name: 'maxLength', message: maxLengthValidationMessage } as ValidationMessageOption;

/**
 * Validation message option for minimum value violations.
 */
export const MIN_VALIDATION_MESSAGE = { name: 'min', message: minValidationMessage } as ValidationMessageOption;

/**
 * Validation message option for maximum value violations.
 */
export const MAX_VALIDATION_MESSAGE = { name: 'max', message: maxValidationMessage } as ValidationMessageOption;

/**
 * Validation message option for invalid phone numbers.
 */
export const INVALID_PHONE_NUMBER_MESSAGE = { name: 'validatePhoneNumber', message: 'This is not a valid phone number.' };

/**
 * Validation message option for invalid phone number extensions.
 */
export const INVALID_PHONE_NUMBER_EXTENSION_MESSAGE = { name: 'validatePhoneNumberExtension', message: 'This is not a valid phone number extension.' };

/**
 * Returns the full set of default validation messages used by the form system.
 *
 * Includes messages for: required, minLength, maxLength, min, max, phone number, and phone number extension.
 *
 * @returns An array of {@link ValidationMessageOption} objects.
 */
export function defaultValidationMessages(): ValidationMessageOption[] {
  return [REQUIRED_VALIDATION_MESSAGE, MIN_LENGTH_VALIDATION_MESSAGE, MAX_LENGTH_VALIDATION_MESSAGE, MIN_VALIDATION_MESSAGE, MAX_VALIDATION_MESSAGE, INVALID_PHONE_NUMBER_MESSAGE, INVALID_PHONE_NUMBER_EXTENSION_MESSAGE];
}
