import { map, type OperatorFunction, switchMap, shareReplay, distinctUntilChanged, type MonoTypeOperatorFunction } from 'rxjs';
import { type MapKeysIntersectionObject, mapKeysIntersectionObjectToArray, mapsHaveSameKeys } from '@dereekb/util';
import { asObservable, type ObservableOrValue } from './getter';

/**
 * RxJS operator that extracts values from a keyed object using a keys observable,
 * returning only the values whose keys are present in both.
 *
 * @param keysObs - observable (or static value) of keys to intersect with
 * @returns an operator that maps a keyed object to an array of matching values
 */
export function mapKeysIntersectionToArray<T>(keysObs: ObservableOrValue<Iterable<string>>): OperatorFunction<MapKeysIntersectionObject<T>, T[]> {
  return switchMap((object) =>
    asObservable(keysObs).pipe(
      map((keys) => mapKeysIntersectionObjectToArray(object, keys)),
      shareReplay(1)
    )
  );
}

/**
 * `distinctUntilChanged` variant for `Map` instances that only emits when the set of map keys changes.
 *
 * @returns an operator that filters out Maps with unchanged key sets
 */
export function distinctUntilMapHasDifferentKeys<I extends Map<K, V>, K, V>(): MonoTypeOperatorFunction<I> {
  return distinctUntilChanged<I>(mapsHaveSameKeys);
}
