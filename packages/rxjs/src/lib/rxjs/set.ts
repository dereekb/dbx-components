import { type Maybe, setContainsAllValues, setContainsAnyValue, setContainsNoneOfValue, type PrimativeKey, type ReadValueFunction, hasSameValues, type EqualityComparatorFunction, compareEqualityWithValueFromItemsFunction } from '@dereekb/util';
import { distinctUntilChanged, type MonoTypeOperatorFunction, type Observable, type OperatorFunction } from 'rxjs';
import { combineLatestMapFrom } from './value';

export function setContainsAllValuesFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsAllValues(set, values ?? []));
}

export function setContainsAnyValueFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsAnyValue(set, values ?? []));
}

export function setContainsNoValueFrom<T>(valuesObs: Observable<Maybe<Iterable<T>>>): OperatorFunction<Set<T>, boolean> {
  return combineLatestMapFrom(valuesObs, (set, values) => setContainsNoneOfValue(set, values ?? []));
}

export function distinctUntilHasDifferentValues<I extends Iterable<K>, K extends PrimativeKey>() {
  return distinctUntilChanged<I>(hasSameValues);
}

export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>): MonoTypeOperatorFunction<I>;
export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>): MonoTypeOperatorFunction<Maybe<I>>;
export function distinctUntilItemsHaveDifferentValues<I, V extends Iterable<PrimativeKey>>(readValues: ReadValueFunction<I, V>) {
  return distinctUntilItemsValueChanges<I, V>(readValues, hasSameValues);
}

export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>): MonoTypeOperatorFunction<I>;
export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>): MonoTypeOperatorFunction<Maybe<I>>;
export function distinctUntilItemsValueChanges<I, V>(readValues: ReadValueFunction<I, V>, isEqualComparator: EqualityComparatorFunction<V>) {
  return distinctUntilChanged<I>(compareEqualityWithValueFromItemsFunction(readValues, isEqualComparator));
}
