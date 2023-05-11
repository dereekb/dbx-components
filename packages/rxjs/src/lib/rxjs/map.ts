import { map, OperatorFunction, switchMap, shareReplay, Observable, distinctUntilChanged } from 'rxjs';
import { MapKeysIntersectionObject, mapKeysIntersectionObjectToArray, mapsHaveSameKeys, PrimativeKey } from '@dereekb/util';
import { asObservable, ObservableOrValue } from './getter';

/**
 * OperatorFunction that pipes the input from the object with a keys observable to produce the result of mapKeysIntersectionObjectToArray.
 *
 * @param keysObs
 * @returns
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
 * Operatorfunction using distinctUntilChanged to check that two maps have the same keys.
 *
 * @returns
 */
export function distinctUntilMapHasDifferentKeys<I extends Map<K, any>, K extends PrimativeKey>() {
  return distinctUntilChanged<I>(mapsHaveSameKeys);
}
