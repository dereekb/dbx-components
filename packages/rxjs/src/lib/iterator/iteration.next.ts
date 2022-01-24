import { map, filter, distinctUntilChanged, delay, switchMap, tap, exhaustMap, first, Observable, combineLatest, shareReplay } from "rxjs";
import { ItemIteration, PageItemIteration } from "./iteration";
import { reduceBooleansWithAndFn } from '@dereekb/util';

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
 * Automatically calls next up to the current maxPageLoadLimit.
 * 
 * The promise will reject with an error if an error is encountered.
 * 
 * @returns 
 */
export function iteratorNextPageUntilMaxPageLoadLimit(iterator: PageItemIteration): Promise<void> {
  return iteratorNextPageUntilPage(iterator, () => iterator.maxPageLoadLimit);
}

/**
 * Automatically calls next on the PageItemIteration up to the target page.
 * 
 * The promise will reject with an error if an error is encountered.
 * 
 * @param iteration 
 * @param page 
 * @returns 
 */
export function iteratorNextPageUntilPage(iteration: PageItemIteration, page: number | (() => number)): Promise<void> {
  const getPageLimit = (typeof page === 'function') ? page : () => page;
  const hasNextAndCanLoadMore$ = iterationHasNextAndCanLoadMore(iteration);
  const latestPage$ = iteration.latestLoadedPage$;
  const latestPageState$ = iteration.latestState$;

  function checkPageLimit(page) {
    const pageLimit = getPageLimit();
    return page < pageLimit && page < iteration.maxPageLoadLimit;
  }

  return new Promise((resolve, reject) => {
    // Changes are triggered off of page number changes.
    const sub = latestPage$.pipe(
      distinctUntilChanged(),
      delay(0)  // Delay to prevent observable in mapping from returning immediately.
    ).pipe(
      // Can always switch to the latest number safely
      switchMap((latestPageNumber) => hasNextAndCanLoadMore$.pipe(
        map((canLoadMore) => (canLoadMore && checkPageLimit(latestPageNumber))),
        tap((canLoadMore) => {

          // Load more
          if (canLoadMore) {
            iteration.next({ page: latestPageNumber + 1 });
          }
        }),
        exhaustMap((canLoadMore) => {
          if (canLoadMore) {
            return latestPageState$.pipe(filter(x => x.page >= latestPageNumber));
          } else {
            return latestPageState$;
          }
        }),
        first()
      ))
    ).subscribe((state) => {
      if (state.error != null) {
        reject(state.error);
        sub.unsubscribe();
      } else if (!checkPageLimit(state.page)) {
        resolve();
        sub.unsubscribe();
      }
    });
  });
}
