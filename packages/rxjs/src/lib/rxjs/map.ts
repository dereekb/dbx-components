import { map, OperatorFunction, switchMap, shareReplay, Observable } from 'rxjs';
import { MapKeysIntersectionObject, mapKeysIntersectionObjectToArray } from '@dereekb/util';
import { asObservable, ObservableOrValue } from './getter';

/**
 * Decision-like that takes in a value and returns an Observable with a boolean.
 */
export type ObservableDecisionFunction<T> = (value: T) => Observable<boolean>;

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
