import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { e164PhoneNumberExtensionPair, isE164PhoneNumber as isE164PhoneNumberFunction, isValidPhoneExtensionNumber } from '@dereekb/util';
import { INVALID_PHONE_NUMBER_EXTENSION_MESSAGE, INVALID_PHONE_NUMBER_MESSAGE } from '../formly/config/validation';

/**
 * Angular Form ValidationFn for checking isE164PhoneNumber the input divisor.
 *
 * @param divisor
 * @returns
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
 * @param divisor
 * @returns
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

export function isE164PhoneNumberWithValidExtension(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | undefined = control.value;

    if (value != null) {
      if (isE164PhoneNumberFunction(value, true)) {
        const pair = e164PhoneNumberExtensionPair(value);

        if (pair.extension && !isValidPhoneExtensionNumber(pair.extension)) {
          return {
            [INVALID_PHONE_NUMBER_EXTENSION_MESSAGE.name]: true
          };
        }
      } else {
        return {
          [INVALID_PHONE_NUMBER_MESSAGE.name]: true
        };
      }
    }

    return {};
  };
}
