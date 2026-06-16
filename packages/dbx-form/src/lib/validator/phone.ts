/* eslint-disable dereekb-util/prefer-maybe-type -- Angular's ValidatorFn returns exactly `ValidationErrors | null`; widening to `Maybe<...>` adds `undefined` and breaks the contract (TS2322). */
import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { e164PhoneNumberExtensionPair, isE164PhoneNumber as isE164PhoneNumberFunction, isValidPhoneExtensionNumber } from '@dereekb/util';

/**
 * Validation message shown when a value is not a valid phone number.
 */
export const INVALID_PHONE_NUMBER_MESSAGE = { name: 'validatePhoneNumber', message: 'This is not a valid phone number.' };

/**
 * Validation message shown when a value is not a valid phone number extension.
 */
export const INVALID_PHONE_NUMBER_EXTENSION_MESSAGE = { name: 'validatePhoneNumberExtension', message: 'This is not a valid phone number extension.' };

/**
 * Angular form validator that checks whether the control value is a valid E.164 phone number.
 *
 * @param allowExtension - Whether to allow phone number extensions in the value.
 * @returns A ValidatorFn that validates E.164 phone numbers.
 */
export function isE164PhoneNumber(allowExtension: boolean): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | undefined = control.value;

    if (value != null && !isE164PhoneNumberFunction(value, allowExtension)) {
      return {
        [INVALID_PHONE_NUMBER_MESSAGE.name]: true
      };
    }

    return {};
  };
}

/**
 * Angular Form ValidationFn for checking the input is a valid phone extension. Empty values return true.
 *
 * @returns A ValidatorFn that validates phone extension numbers.
 */
export function isPhoneExtension(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | number | undefined = control.value;

    if (value != null) {
      const asString = value.toString();

      if (asString.length > 0 && !isValidPhoneExtensionNumber(asString)) {
        return {
          [INVALID_PHONE_NUMBER_EXTENSION_MESSAGE.name]: true
        };
      }
    }

    return {};
  };
}

/**
 * Angular form validator that checks the value is a valid E.164 phone number with a valid extension (if present).
 *
 * @returns A ValidatorFn that validates E.164 phone numbers with optional extensions.
 */
export function isE164PhoneNumberWithValidExtension(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | undefined = control.value;
    let errors: ValidationErrors = {};

    if (value != null) {
      if (isE164PhoneNumberFunction(value, true)) {
        const pair = e164PhoneNumberExtensionPair(value);

        if (pair.extension && !isValidPhoneExtensionNumber(pair.extension)) {
          errors = {
            [INVALID_PHONE_NUMBER_EXTENSION_MESSAGE.name]: true
          };
        }
      } else {
        errors = {
          [INVALID_PHONE_NUMBER_MESSAGE.name]: true
        };
      }
    }

    return errors;
  };
}
