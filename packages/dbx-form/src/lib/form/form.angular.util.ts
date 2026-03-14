import { type AbstractControl } from '@angular/forms';
import { type Maybe } from '@dereekb/util';
import { type Observable, startWith } from 'rxjs';

/**
 * A FormGroup/AbstractControl path to a specific control.
 */
export type FormControlPath = string;

/**
 * Streams a value from the input control at the given path. If no path is specified, streams the value from the control.
 *
 * Returns `undefined` if the control at the given path does not exist.
 *
 * @param fromControl - The root control to retrieve the target control from.
 * @param path - Optional dot-delimited path to a nested control.
 * @returns An observable of the control's value changes (starting with the current value), or `undefined` if the control was not found.
 *
 * @example
 * ```ts
 * const name$ = streamValueFromControl<string>(formGroup, 'user.name');
 * ```
 */
export function streamValueFromControl<T>(fromControl: AbstractControl, path?: FormControlPath): Maybe<Observable<T>> {
  const control = path ? fromControl.get(path) : fromControl;
  return control?.valueChanges.pipe(startWith(control.value));
}
