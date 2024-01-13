import { type Observable, startWith, distinctUntilChanged, shareReplay, map, type OperatorFunction, first } from 'rxjs';

/**
 * Operator that returns true until the first item is emitted. Then returns false.
 *
 * @returns
 */
export function isLoading<T>(): OperatorFunction<T, boolean> {
  return (source: Observable<T>) => {
    return source.pipe(
      first(),
      map(() => false),
      startWith(true),
      distinctUntilChanged(),
      shareReplay(1)
    );
  };
}
