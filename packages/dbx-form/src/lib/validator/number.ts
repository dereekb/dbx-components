import { AbstractControl, ValidatorFn } from '@angular/forms';

export function IsInRange(min: number = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } => {
        const numberString: string | undefined = control.value;

        const errors: any = {};

        if (numberString) {
            const value = Number(numberString);

            if (!isNaN(value)) {
                const bigEnough = value >= min;
                const smallEnough = value <= max;

                if (!bigEnough) {
                    errors.min = value;
                }

                if (!smallEnough) {
                    errors.max = value;
                }
            }
        }

        return errors;
    };
}
