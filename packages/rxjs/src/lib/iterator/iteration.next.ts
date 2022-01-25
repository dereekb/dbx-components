import { map, filter, distinctUntilChanged, delay, switchMap, tap, exhaustMap, first, Observable, combineLatest, shareReplay } from "rxjs";
import { ItemIteration, PageItemIteration } from "./iteration";
import { performTaskLoop, reduceBooleansWithAndFn } from '@dereekb/util';

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
export function iteratorNextPageUntilMaxPageLoadLimit(iterator: PageItemIteration): Promise<number> {
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
export function iteratorNextPageUntilPage(iteration: PageItemIteration, page: number | (() => number)): Promise<number> {
  const getPageLimit = (typeof page === 'function') ? page : () => page;

  function checkPageLimit(page) {
    const pageLimit = getPageLimit();
    return page < Math.min(pageLimit, iteration.maxPageLoadLimit);
  }

  return new Promise((resolve) => {
    iteration.latestLoadedPage$.pipe(
      first(),
    ).subscribe((firstLatestPage: number) => {
      const promise = performTaskLoop({
        initValue: firstLatestPage,
        checkContinue: (latestPage) => checkPageLimit(latestPage),
        next: () => iteration.nextPage()
      });

      resolve(promise);
    });
  });
}
