import { map, first, Observable, combineLatest, shareReplay } from 'rxjs';
import { ItemIteration, PageItemIteration } from './iteration';
import { Maybe, performTaskLoop, reduceBooleansWithAndFn, GetterOrValue, asGetter, isMaybeNot } from '@dereekb/util';

/**
 * Creates an observable from the input iteration that checks both the hasNext$ and canLoadMore$ states.
 *
 * @param iteration
 * @returns
 */
export function iterationHasNextAndCanLoadMore<V>(iteration: ItemIteration<V>): Observable<boolean> {
  return combineLatest([iteration.hasNext$, iteration.canLoadMore$]).pipe(map(reduceBooleansWithAndFn(true)), shareReplay(1));
}

/**
 * Automatically calls next up to the current maxPageLoadLimit configured on the iterator.
 *
 * If no maximum limit is defined, uses the defaultLimit. If default limit is not defined or null, this will result in an error.
 *
 * The promise will reject with an error if an error is encountered.
 *
 * @param iterator
 * @param defaultLimit
 * @returns
 */
export function iteratorNextPageUntilMaxPageLoadLimit(iterator: PageItemIteration, defaultLimit: Maybe<number> = 100): Promise<number> {
  return iteratorNextPageUntilPage(iterator, () => {
    const limit: Maybe<number> = iterator.maxPageLoadLimit ?? defaultLimit;

    if (isMaybeNot(limit)) {
      throw new Error('iteratorNextPageUntilMaxPageLoadLimit() failed. There was no maximum defined.');
    }

    return limit;
  });
}

/**
 * Automatically calls next on the PageItemIteration up to the target page, the number of total pages that should be loaded.
 *
 * The promise will reject with an error if an error is encountered.
 *
 * @param iteration
 * @param page
 * @returns
 */
export function iteratorNextPageUntilPage(iteration: PageItemIteration, page: GetterOrValue<number>): Promise<number> {
  const getPageLimit = asGetter(page);

  function checkPageLimit(page: number): boolean {
    const pageLimit = getPageLimit();
    const maxLimit = Math.min(pageLimit, iteration.maxPageLoadLimit ?? Number.MAX_SAFE_INTEGER);
    return page + 1 < maxLimit;
  }

  return new Promise((resolve) => {
    iteration.latestLoadedPage$.pipe(first()).subscribe((firstLatestPage: number) => {
      const promise: Promise<number> = performTaskLoop<number>({
        initValue: firstLatestPage,
        checkContinue: (latestPage: number) => checkPageLimit(latestPage),
        next: async () => await iteration.nextPage()
      });

      resolve(promise);
    });
  });
}
