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
 * @param fromControl
 * @param path
 * @returns
 */
export function streamValueFromControl<T>(fromControl: AbstractControl, path?: FormControlPath): Maybe<Observable<T>> {
  const control = path ? fromControl.get(path) : fromControl;
  return control?.valueChanges.pipe(startWith(control.value));
}
