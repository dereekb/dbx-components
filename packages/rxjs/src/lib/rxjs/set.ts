import { Maybe, setContainsAllValues, setContainsAnyValue, setContainsNoneOfValue } from '@dereekb/util';
import { Observable, OperatorFunction } from 'rxjs';
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
