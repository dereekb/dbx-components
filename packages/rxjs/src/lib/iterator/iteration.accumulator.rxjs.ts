import { lastValue, flattenArray } from '@dereekb/util';
import { filterMaybe, scanBuildArray } from '../rxjs';
import { combineLatest, map, Observable, shareReplay, skipWhile } from 'rxjs';
import { mapLoadingStateResults, mapLoadingStateValueFunction, PageListLoadingState } from '../loading';
import { ItemAccumulator, PageItemAccumulator } from './iteration.accumulator';

/**
 * Used for ItemAccumulators that have an array of results returned per page instead of a single item.
 * 
 * @param accumulator 
 * @returns 
 */
export function flattenAccumulatorResultItemArray<T>(accumulator: ItemAccumulator<T[]>): Observable<T[]> {
  return accumulator.allItems$.pipe(
    scanBuildArray((allItems: T[][]) => {
      const seed = flattenArray(allItems);
      const latestItem = lastValue(allItems);

      const mapStateToItem = mapLoadingStateValueFunction(accumulator.mapItemFunction);
      const accumulatorObs: Observable<T[]> = accumulator.itemIteration.latestState$.pipe(
        skipWhile(x => x.value === latestItem),
        map(mapStateToItem),
        filterMaybe()
      );

      return {
        seed,
        accumulatorObs,
        flattenArray: true
      } as any;
    })
  );
}

/**
 * A PageListLoadingState that captures all the values that have been loaded so far, flattens them as an array, and the current loading state of currentPageResult$.
 */
export function accumulatorFlattenPageListLoadingState<T>(accumulator: PageItemAccumulator<T[]>): Observable<PageListLoadingState<T>> {
  return combineLatest([accumulator.itemIteration.currentState$, flattenAccumulatorResultItemArray(accumulator)]).pipe(
    map(([state, values]) => mapLoadingStateResults(state, {
      mapValue: () => values
    }) as PageListLoadingState<T>),
    shareReplay(1)
  );
}

/**
 * A PageListLoadingState that captures all the values that have been loaded so far, and the current loading state of currentPageResult$.
 */
export function accumulatorCurrentPageListLoadingState<V>(accumulator: PageItemAccumulator<V>): Observable<PageListLoadingState<V>> {
  return combineLatest([accumulator.itemIteration.currentState$, accumulator.allItems$]).pipe(
    map(([state, values]) => mapLoadingStateResults(state, {
      mapValue: () => values
    }) as PageListLoadingState<V>),
    shareReplay(1)
  );
}
