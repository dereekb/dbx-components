import { reduceBooleansWithAndFn } from '@dereekb/util';
import { combineLatest, map, Observable, shareReplay } from 'rxjs';
import { mapLoadingStateResults, PageListLoadingState } from '../loading';
import { ItemIteration, PageItemIteration } from './iteration';

/**
 * Creates an observable from the input iteration that checks both the hasNext$ and canLoadMore$ states.
 * 
 * @param iteration 
 * @returns 
 */
export function iterationHasNextAndCanLoadMore<V>(iteration: ItemIteration<V>): Observable<boolean> {
  return combineLatest([iteration.hasNext$, iteration.canLoadMore$]).pipe(
    map(reduceBooleansWithAndFn(true)),
    shareReplay(1)
  );
}


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
