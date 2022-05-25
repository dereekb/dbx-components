import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

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
