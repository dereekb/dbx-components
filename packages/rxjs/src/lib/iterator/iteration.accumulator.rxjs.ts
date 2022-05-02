import { lastValue, flattenArray } from '@dereekb/util';
import { filterMaybe, scanBuildArray } from '../rxjs';
import { combineLatest, map, Observable, shareReplay, skipWhile } from 'rxjs';
import { mapLoadingStateResults, PageListLoadingState } from '../loading';
import { ItemAccumulator, PageItemAccumulator } from './iteration.accumulator';

/**
 * Used for ItemAccumulators that have an array of results returned per page instead of a single item.
 * 
 * @param iteration 
 * @returns 
 */
export function flattenIterationResultItemArray<T>(iteration: ItemAccumulator<T[]>): Observable<T[]> {
  return iteration.allItems$.pipe(
    scanBuildArray((allItems: T[][]) => {
      const seed = flattenArray(allItems);
      const latestItem = lastValue(allItems);

      const accumulatorObs: Observable<T[]> = iteration.itemIteration.latestState$.pipe(
        skipWhile(x => x.value === latestItem),
        map(x => x.value),
        filterMaybe()
      );

      return {
        seed,
        accumulatorObs
      } as any;
    })
  );
}

/**
 * A PageListLoadingState that captures all the values that have been loaded so far, and the current loading state of currentPageResult$.
 */
export function iterationCurrentPageListLoadingState<V>(accumulator: PageItemAccumulator<V>): Observable<PageListLoadingState<V>> {
  return combineLatest([accumulator.itemIteration.currentState$, accumulator.allItems$]).pipe(
    map(([state, values]) => mapLoadingStateResults(state, {
      mapValue: () => values
    }) as PageListLoadingState<V>),
    shareReplay(1)
  );
}
