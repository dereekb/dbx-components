import { areEqualPOJOValues } from '@dereekb/util';
import { distinctUntilChanged, filter, mergeMap, isObservable, type MonoTypeOperatorFunction, type Observable } from 'rxjs';

/**
 * RxJS operator that suppresses consecutive emissions when the emitted POJO values are deeply equal.
 *
 * Uses {@link areEqualPOJOValues} for comparison, so the emitted objects should be plain objects
 * or compatible with deep value equality checks.
 *
 * @returns operator that filters out consecutive duplicate POJO emissions
 *
 * @example
 * ```ts
 * of({ a: 1 }, { a: 1 }, { a: 2 }).pipe(
 *   distinctUntilObjectValuesChanged()
 * ).subscribe(console.log);
 * // Output: { a: 1 }, { a: 2 }
 * ```
 */
export function distinctUntilObjectValuesChanged<T>(): MonoTypeOperatorFunction<T> {
  return distinctUntilChanged((a, b) => areEqualPOJOValues(a, b));
}

/**
 * RxJS operator that filters out emissions that are deeply equal to a reference value.
 *
 * Accepts either a static reference value or an observable of reference values. When given an observable,
 * each emission is compared against the latest reference value. Uses {@link areEqualPOJOValues} for comparison.
 *
 * @param inputFilter - static reference value or observable of reference values to compare against
 * @returns operator that only passes through values that differ from the reference
 *
 * @example
 * ```ts
 * const ref = { status: 'active' };
 * of({ status: 'active' }, { status: 'inactive' }).pipe(
 *   filterIfObjectValuesUnchanged(ref)
 * ).subscribe(console.log);
 * // Output: { status: 'inactive' }
 * ```
 */
export function filterIfObjectValuesUnchanged<F>(inputFilter: F): MonoTypeOperatorFunction<F>;
export function filterIfObjectValuesUnchanged<F>(obs: Observable<F>): MonoTypeOperatorFunction<F>;
export function filterIfObjectValuesUnchanged<F>(input: F | Observable<F>): MonoTypeOperatorFunction<F> {
  const result: MonoTypeOperatorFunction<F> = isObservable(input) ? mergeMap<F, Observable<F>>((inputFilter) => input.pipe(filterIfObjectValuesUnchanged(inputFilter))) : filter((inputObject) => !areEqualPOJOValues(input, inputObject));
  return result;
}
