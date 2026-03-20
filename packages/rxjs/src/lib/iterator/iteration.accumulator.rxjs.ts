import { lastValue, flattenArray } from '@dereekb/util';
import { filterMaybe, scanBuildArray } from '../rxjs';
import { combineLatest, map, type Observable, shareReplay, skipWhile } from 'rxjs';
import { mapLoadingStateResults, mapLoadingStateValueFunction, type PageListLoadingState } from '../loading';
import { type ItemAccumulator, type ItemAccumulatorValuePair, type PageItemAccumulator } from './iteration.accumulator';

/**
 * Flattens paginated array results from an {@link ItemAccumulator} into a single growing array.
 *
 * Designed for accumulators where each page returns an array of items. Concatenates all
 * page results into one flat array that grows as new pages are loaded.
 *
 * @param accumulator - accumulator whose page results are arrays to flatten
 * @returns observable emitting the flattened array of all accumulated items
 */
export function flattenAccumulatorResultItemArray<T, I = unknown>(accumulator: ItemAccumulator<T[], I>): Observable<T[]> {
  return accumulator.currentAllItemPairs$.pipe(
    scanBuildArray<ItemAccumulatorValuePair<T[], I>[], T>((allItems: ItemAccumulatorValuePair<T[], I>[]) => {
      const pairs: ItemAccumulatorValuePair<T[], I>[] = allItems;
      const firstLatestItemPair = lastValue(allItems);
      const skipValue = firstLatestItemPair?.input; // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- lastValue() can return undefined at runtime for empty arrays
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
 * Combines a page accumulator's flattened array results with its current loading state
 * into a single {@link PageListLoadingState} observable.
 *
 * The loading state reflects whether a page is currently being fetched, while the value
 * always contains the full flattened array of all items loaded so far.
 *
 * @param accumulator - page accumulator whose results are arrays to flatten
 * @returns observable of the combined loading state with all accumulated items
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
 * Combines a page accumulator's collected items with its current loading state
 * into a single {@link PageListLoadingState} observable.
 *
 * Unlike {@link accumulatorFlattenPageListLoadingState}, this does not flatten arrays —
 * each accumulated value is included as-is.
 *
 * @param accumulator - page accumulator to observe
 * @returns observable of the combined loading state with all accumulated items
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

/**
 * Returns the latest loaded page number from the input accumulator's underlying iteration.
 *
 * @param pageItemAccumulator - accumulator to observe the current page from
 * @returns observable emitting the most recently loaded page number
 */
export function pageItemAccumulatorCurrentPage(pageItemAccumulator: PageItemAccumulator<any, any>): Observable<number> {
  return pageItemAccumulator.itemIteration.latestLoadedPage$;
}
