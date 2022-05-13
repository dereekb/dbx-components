import { areEqualPOJOValues } from "@dereekb/util";
import { isObservable, MonoTypeOperatorFunction, Observable, OperatorFunction } from "rxjs";
import { distinctUntilChanged, filter, mergeMap } from "rxjs/operators";

/**
 * Equivalent to distinctUntilChanged() using isEqualObject()
 */
export function distinctUntilObjectValuesChanged<T>(): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged((a, b) => areEqualPOJOValues(a, b));
}

/**
 * Observable filter that filters the input if the object is unchanged/equal to the input.
 */
export function filterIfObjectValuesUnchanged<F>(inputFilter: F): MonoTypeOperatorFunction<F>;
export function filterIfObjectValuesUnchanged<F>(obs: Observable<F>): MonoTypeOperatorFunction<F>;
export function filterIfObjectValuesUnchanged<F>(input: F | Observable<F>): MonoTypeOperatorFunction<F> {
  if (isObservable(input)) {
    return mergeMap<F, Observable<F>>((inputFilter) => {
      return input.pipe(filterIfObjectValuesUnchanged(inputFilter))
    });
  } else {
    return filter((inputObject) => !areEqualPOJOValues(input, inputObject))
  }
}
