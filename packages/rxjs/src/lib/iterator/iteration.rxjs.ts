import { reduceBooleansWithAndFn } from '@dereekb/util';
import { combineLatest, map, Observable, shareReplay } from 'rxjs';
import { mapLoadingStateResults, PageListLoadingState } from '../loading';
import { ItemIteration, PageItemIteration } from './iteration';


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
