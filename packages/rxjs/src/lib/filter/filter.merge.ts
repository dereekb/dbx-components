import { mergeObjects, type Maybe } from '@dereekb/util';
import { combineLatest, map, shareReplay, type Observable } from 'rxjs';
import { distinctUntilObjectValuesChanged } from '../object';
import { type FilterWithPreset } from './filter';

/**
 * Function that merges several partial filters into a single filter.
 *
 * Filters are applied left-to-right, so the last filter in the array has the highest priority.
 */
export type MergeFiltersFunction<F> = (filters: Maybe<Partial<F>>[]) => F;

/**
 * Merges several partial filters into a single filter.
 *
 * Filters are applied left-to-right, so the last filter wins when two filters set the same field.
 * `undefined` values never overwrite a previously set value.
 *
 * The `preset` field is removed from the result, since a merged filter cannot represent more than one preset.
 * Each source filter keeps its own preset, so any preset menu bound to a single source still shows its selection.
 *
 * @param filters - Partial filters (or null/undefined) to merge.
 * @returns The merged filter, without a `preset` value.
 *
 * @example
 * ```ts
 * mergeFilters([{ date, preset: 'today' }, { minPrice: 100 }]);
 * // { date, minPrice: 100 }
 * ```
 */
export function mergeFilters<F extends object>(filters: Maybe<Partial<F>>[]): F {
  const merged = mergeObjects<F>(filters) as Partial<F> & FilterWithPreset;
  delete merged.preset;
  return merged as F;
}

/**
 * Combines the latest value of each filter observable into a single merged filter observable.
 *
 * Emits once every input has emitted, then again whenever any input emits a new value.
 * Consecutive emissions with equal values are suppressed.
 *
 * @param filterObs - Filter observables to combine. Every observable must emit at least once for the result to emit.
 * @param mergeFn - Function used to merge the latest filters. Defaults to {@link mergeFilters}.
 * @returns Observable of the merged filter.
 *
 * @example
 * ```ts
 * const filter$ = combineFilters([dateFilter$, attributesFilter$]);
 * ```
 */
export function combineFilters<F extends object>(filterObs: Observable<Maybe<Partial<F>>>[], mergeFn: MergeFiltersFunction<F> = mergeFilters): Observable<F> {
  return combineLatest(filterObs).pipe(
    map((filters) => mergeFn(filters)),
    distinctUntilObjectValuesChanged(),
    shareReplay(1)
  );
}
