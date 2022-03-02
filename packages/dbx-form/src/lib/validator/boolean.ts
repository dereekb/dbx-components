import { AbstractControl, ValidatorFn } from '@angular/forms';

export function IsTruthy(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } => {
    const value: boolean | undefined = control.value;

    if (!value) {
      return {
        isTruthy: value
      };
    }

    return {};
  };
}
