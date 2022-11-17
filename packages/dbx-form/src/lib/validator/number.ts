import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { isNumberDivisibleBy, nearestDivisibleValues } from '@dereekb/util';

/**
 * Merges the use of the min and max validator.
 *
 * @param min
 * @param max
 * @returns
 */
export function isInRange(min: number = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): ValidatorFn {
  const minFn = Validators.min(min);
  const maxFn = Validators.max(max);

  return (control: AbstractControl): ValidationErrors | null => {
    const minError = minFn(control);
    const maxError = maxFn(control);

    let errors: ValidationErrors | null = null;

    if (minError || maxError) {
      errors = {
        ...minError,
        ...maxError
      };
    }

    return errors;
  };
}

export const IS_DIVISIBLE_BY_VALIDATION_KEY = 'isDivisibleBy';

export interface IsDivisibleByError {
  value: number;
  nearest: number;
  divisor: number;
  message: string;
}

/**
 * Angular Form ValidationFn for checking isDivisibleBy the input divisor.
 *
 * @param divisor
 * @returns
 */
export function isDivisibleBy(divisor: number): ValidatorFn {
  if (divisor === 0) {
    throw new Error('Divisior must be greater than zero.');
  }

  return (control: AbstractControl): ValidationErrors | null => {
    const value: number | undefined = control.value;

    if (value != null && !isNumberDivisibleBy(value, divisor)) {
      const nearest = nearestDivisibleValues(value, divisor);
      return {
        [IS_DIVISIBLE_BY_VALIDATION_KEY]: {
          value,
          divisor,
          nearest,
          message: `Number must by divisible by ${divisor}. The two nearest valid values are ${nearest.nearestFloor} and ${nearest.nearestCeil}.`
        }
      };
    }

    return {};
  };
}
