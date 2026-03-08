import { type Observable, startWith, distinctUntilChanged, shareReplay, map, type OperatorFunction, first } from 'rxjs';

/**
 * RxJS operator that emits `true` immediately (loading), then `false` after the source emits its first value.
 *
 * Only considers the first emission from the source. The result is shared via `shareReplay(1)`.
 *
 * @example
 * ```ts
 * const loading$ = dataFetch$.pipe(isLoading());
 * // emits true initially, then false once dataFetch$ emits
 * ```
 *
 * @returns an operator that tracks whether the first value has been emitted
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
