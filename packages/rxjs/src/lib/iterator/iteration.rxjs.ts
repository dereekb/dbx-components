import { lastValue, flattenArray } from '@dereekb/util';
import { filterMaybe, scanBuildArray } from '../rxjs';
import { combineLatest, map, Observable, shareReplay, skipWhile } from 'rxjs';
import { mapLoadingStateResults, PageListLoadingState } from '../loading';
import { PageItemIteration } from './iteration';


/**
 * A PageListLoadingState that captures all the values that have been loaded so far, and the current loading state of currentPageResult$.
 */
export function iterationCurrentPageListLoadingState<V>(iteration: PageItemIteration<V>): Observable<PageListLoadingState<V>> {
  return combineLatest([iteration.currentPageState$, iteration.allItems$]).pipe(
    map(([state, values]) => mapLoadingStateResults(state, {
      mapValue: () => values
    }) as PageListLoadingState<V>),
    shareReplay(1)
  );
}

/**
 * Used for PageItemIterations that have an array of results returned per page instead of a single item.
 * 
 * @param iteration 
 * @returns 
 */
export function flattenIterationResultItemArray<T>(iteration: PageItemIteration<T[]>): Observable<T[]> {
  return iteration.allItems$.pipe(
    scanBuildArray((allItems: T[][]) => {
      const seed = flattenArray(allItems);
      const latestItem = lastValue(allItems);

      const accumulatorObs: Observable<T[]> = iteration.latestState$.pipe(
        skipWhile(x => x.model === latestItem),
        map(x => x.model),
        filterMaybe()
      );

      return {
        seed,
        accumulatorObs
      } as any;
    })
  );
}
