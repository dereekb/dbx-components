import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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
