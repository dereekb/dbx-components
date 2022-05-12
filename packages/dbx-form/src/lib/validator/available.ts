import { switchMap } from 'rxjs/operators';
import { firstValueFrom, map, Observable } from 'rxjs';
import { AbstractControl, AsyncValidatorFn } from "@angular/forms";
import { asyncPusherCache, tapLog } from '@dereekb/rxjs';

export const FIELD_VALUE_IS_AVAILABLE_VALIDATION_KEY = 'fieldValueIsAvailable';

export type FieldValueIsAvailableValidatorFunction<T> = (value: T) => Observable<boolean>;

export interface FieldValueIsAvailableValidatorConfig<T> {

  /**
   * How long to wait in between value changes.
   */
  debounceTime?: number;

  /**
   * Returns an observable that checks whether or not the value is currently available.
   * 
   * @param value 
   */
  readonly checkValueIsAvailable: FieldValueIsAvailableValidatorFunction<T>;

  /**
   * Custom message for this validator.
   */
  message?: string;

}

/**
 * Validator for validating all values within an object. 
 * 
 * This is useful for validating a control group where two or more values are expected to be the same, such as a password and a password verification field.
 * 
 * @param config 
 * @returns 
 */
export function fieldValueIsAvailableValidator<T>(config: FieldValueIsAvailableValidatorConfig<T>): AsyncValidatorFn {
  const {
    checkValueIsAvailable,
    message = 'This value is not available.'
  } = config;

  const pusher = asyncPusherCache();
  return (control: AbstractControl) => firstValueFrom(pusher(control.valueChanges)(control.value).pipe(
    switchMap(() => checkValueIsAvailable(control.value)),
    map((isAvailable) => {
      if (isAvailable) {
        return null;
      } else {
        return {
          [FIELD_VALUE_IS_AVAILABLE_VALIDATION_KEY]: { message }
        };
      }
    })));
}
