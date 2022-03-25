import { asObservable } from '@dereekb/rxjs';
import { map, OperatorFunction, switchMap, shareReplay } from 'rxjs';
import { MapKeysIntersectionObject, mapKeysIntersectionObjectToArray } from "@dereekb/util";
import { ObservableGetter } from "./getter";

/**
 * OperatorFunction that pipes the input from the object with a keys observable to produce the result of mapKeysIntersectionObjectToArray.
 * 
 * @param keysObs 
 * @returns 
 */
export function mapKeysIntersectionToArray<T>(keysObs: ObservableGetter<Iterable<string>>): OperatorFunction<MapKeysIntersectionObject<T>, T[]> {
  return switchMap((object) => asObservable(keysObs).pipe(
    map(keys => mapKeysIntersectionObjectToArray(object, keys)),
    shareReplay(1)
  ));
}
