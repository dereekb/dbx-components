import { combineLatest, Observable, of } from 'rxjs';

/**
 * Creates a map function that maps the input Map to an Observable that returns values mapped from the map's values.
 * 
 * @param mapToObs 
 * @returns 
 */
export function combineLatestFromMapValuesObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (map: Map<unknown, T>) => Observable<O[]> {
  const combineArrayFn = combineLatestFromArrayObsFn(mapToObs);
  return (latestMap: Map<unknown, T>) => {
    const mapValues = Array.from(latestMap).map(y => y[1]);
    return combineArrayFn(mapValues);
  };
}

export function combineLatestFromArrayObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (values: T[]) => Observable<O[]> {
  return (latest) => {
    const newObs = latest.map(mapToObs);
    return (newObs.length) ? combineLatest(newObs) : of([]);
  };
}
