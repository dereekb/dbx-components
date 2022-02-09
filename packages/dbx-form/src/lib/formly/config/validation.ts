import { FieldTypeConfig } from '@ngx-formly/core';
import { ValidationMessageOption } from '@ngx-formly/core/lib/models';

export function minLengthValidationMessage(err: any, field: FieldTypeConfig) {
  return `Should have atleast ${field.templateOptions.minLength} characters`;
}

export function maxLengthValidationMessage(err: any, field: FieldTypeConfig) {
  return `This value should be less than ${field.templateOptions.maxLength} characters`;
}

export function minValidationMessage(err: any, field: FieldTypeConfig) {
  return `This value should be more than ${field.templateOptions.min}`;
}

export function maxValidationMessage(err: any, field: FieldTypeConfig) {
  return `This value should be less than ${field.templateOptions.max}`;
}

export const REQUIRED_VALIDATION_MESSAGE = { name: 'required', message: 'This field is required' };
export const MIN_LENGTH_VALIDATION_MESSAGE = { name: 'minlength', message: minLengthValidationMessage } as ValidationMessageOption;
export const MAX_LENGTH_VALIDATION_MESSAGE = { name: 'maxlength', message: maxLengthValidationMessage } as ValidationMessageOption;
export const MIN_VALIDATION_MESSAGE = { name: 'min', message: minValidationMessage } as ValidationMessageOption;
export const MAX_VALIDATION_MESSAGE = { name: 'max', message: maxValidationMessage } as ValidationMessageOption;

export function defaultValidationMessages(): ValidationMessageOption[] {
  return [REQUIRED_VALIDATION_MESSAGE, MIN_LENGTH_VALIDATION_MESSAGE, MAX_LENGTH_VALIDATION_MESSAGE, MIN_VALIDATION_MESSAGE, MAX_VALIDATION_MESSAGE];
}
