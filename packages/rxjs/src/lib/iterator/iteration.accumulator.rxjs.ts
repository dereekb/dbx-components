import { lastValue, flattenArray } from '@dereekb/util';
import { filterMaybe, scanBuildArray } from '../rxjs';
import { combineLatest, map, Observable, shareReplay, skipWhile } from 'rxjs';
import { mapLoadingStateResults, mapLoadingStateValueFunction, PageListLoadingState } from '../loading';
import { ItemAccumulator, ItemAccumulatorValuePair, PageItemAccumulator } from './iteration.accumulator';

/**
 * Used for ItemAccumulators that have an array of results returned per page instead of a single item.
 *
 * @param accumulator
 * @returns
 */
export function flattenAccumulatorResultItemArray<T, I = unknown>(accumulator: ItemAccumulator<T[], I>): Observable<T[]> {
  return accumulator.currentAllItemPairs$.pipe(
    scanBuildArray<ItemAccumulatorValuePair<T[], I>[], T>((allItems: ItemAccumulatorValuePair<T[], I>[]) => {
      const pairs: ItemAccumulatorValuePair<T[], I>[] = allItems;
      const firstLatestItemPair = lastValue(allItems);
      const skipValue = firstLatestItemPair?.input;
      const seed: T[] = flattenArray(pairs.map((x) => x.output));

      const mapStateToItem = mapLoadingStateValueFunction(accumulator.mapItemFunction);
      const accumulatorObs: Observable<T[]> = accumulator.itemIteration.latestState$.pipe(
        skipWhile((x) => x.value === skipValue),
        map(mapStateToItem),
        filterMaybe()
      );

      return {
        seed,
        accumulatorObs,
        flattenArray: true
      };
    })
  );
}

/**
 * A PageListLoadingState that captures all the values that have been loaded so far, flattens them as an array, and the current loading state of currentPageResult$.
 */
export function accumulatorFlattenPageListLoadingState<T, I = unknown>(accumulator: PageItemAccumulator<T[], I>): Observable<PageListLoadingState<T>> {
  return combineLatest([accumulator.itemIteration.currentState$, flattenAccumulatorResultItemArray(accumulator)]).pipe(
    map(
      ([state, values]) =>
        mapLoadingStateResults(state, {
          alwaysMapValue: true,
          mapValue: () => values
        }) as PageListLoadingState<T>
    ),
    shareReplay(1)
  );
}

/**
 * A PageListLoadingState that captures all the values that have been loaded so far, and the current loading state of currentPageResult$.
 */
export function accumulatorCurrentPageListLoadingState<V, I = unknown>(accumulator: PageItemAccumulator<V, I>): Observable<PageListLoadingState<V>> {
  return combineLatest([accumulator.itemIteration.currentState$, accumulator.currentAllItems$]).pipe(
    map(
      ([state, values]) =>
        mapLoadingStateResults(state, {
          alwaysMapValue: true,
          mapValue: () => values
        }) as PageListLoadingState<V>
    ),
    shareReplay(1)
  );
}
