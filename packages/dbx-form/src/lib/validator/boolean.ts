import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';

/**
 * Angular form validator that requires the control value to be truthy.
 *
 * @returns A ValidatorFn that fails when the value is falsy
 */
export function isTruthy(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: boolean | undefined = control.value;

    if (!value) {
      return {
        isTruthy: value
      };
    }

    return {};
  };
}
