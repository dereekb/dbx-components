import { type Maybe, setContainsAllValues, setContainsAnyValue, setContainsNoneOfValue, type PrimativeKey, type ReadValueFunction, hasSameValues, type EqualityComparatorFunction, compareEqualityWithValueFromItemsFunction } from '@dereekb/util';
import { distinctUntilChanged, type MonoTypeOperatorFunction, type Observable, type OperatorFunction } from 'rxjs';
import { combineLatestMapFrom } from './value';

/**
 * RxJS operator that checks whether the emitted `Set` contains all values from the given observable.
 *
 * @param valuesObs - observable of values to check against
 * @returns an operator that emits true if all values are contained in the set
 */
export function setContainsAllValuesFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsAllValues(set, values ?? []));
}

/**
 * RxJS operator that checks whether the emitted `Set` contains any value from the given observable.
 *
 * @param valuesObs - observable of values to check against
 * @returns an operator that emits true if any value is contained in the set
 */
export function setContainsAnyValueFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsAnyValue(set, values ?? []));
}

/**
 * RxJS operator that checks whether the emitted `Set` contains none of the values from the given observable.
 *
 * @param valuesObs - observable of values to check against
 * @returns an operator that emits true if no values are contained in the set
 */
export function setContainsNoValueFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsNoneOfValue(set, values ?? []));
}

/**
 * `distinctUntilChanged` variant for iterables that only emits when the contained values change.
 */
export function distinctUntilHasDifferentValues<I extends Iterable<K>, K extends PrimativeKey>() {
  return distinctUntilChanged<I>(hasSameValues);
}

/**
 * `distinctUntilChanged` variant that extracts iterable values from the emitted item and only emits
 * when the set of extracted values changes.
 *
 * @param readValues - function to extract the iterable of values to compare
 */
export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>): MonoTypeOperatorFunction<I>;
export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>): MonoTypeOperatorFunction<Maybe<I>>;
export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>) {
  return distinctUntilItemsValueChanges<I, V>(readValues, hasSameValues);
}

/**
 * `distinctUntilChanged` variant that extracts values from the emitted item and compares them
 * using a custom equality comparator.
 *
 * @param readValues - function to extract the value to compare
 * @param isEqualComparator - custom equality function for the extracted values
 */
export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>): MonoTypeOperatorFunction<I>;
export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>): MonoTypeOperatorFunction<Maybe<I>>;
export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>) {
  return distinctUntilChanged<I>(compareEqualityWithValueFromItemsFunction(readValues, isEqualComparator));
}
