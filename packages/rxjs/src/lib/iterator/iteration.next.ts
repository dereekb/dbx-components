import { first, type Observable, shareReplay, firstValueFrom, switchMap, of } from 'rxjs';
import { type ItemIteration, type PageItemIteration } from './iteration';
import { type Maybe, performTaskLoop, type GetterOrValue, asGetter, isMaybeNot, type PageNumber } from '@dereekb/util';

/**
 * Combines an iteration's `hasNext$` and `canLoadMore$` into a single observable that emits
 * `true` only when both conditions are met (more items exist and the page limit hasn't been reached).
 *
 * @param iteration - the iteration to check
 * @returns observable that emits `true` when more items can be loaded
 */
export function iterationHasNextAndCanLoadMore<V>(iteration: ItemIteration<V>): Observable<boolean> {
  return iteration.canLoadMore$.pipe(
    switchMap((canLoadMore) => {
      return canLoadMore ? iteration.hasNext$ : of(false);
    }),
    shareReplay(1)
  );
}

/**
 * Automatically pages through a {@link PageItemIteration} until its configured max page load limit is reached.
 *
 * Falls back to the provided default limit if no max is configured on the iterator.
 *
 * @param iterator - the page iteration to advance
 * @param defaultLimit - fallback page limit if none is configured (defaults to 100)
 * @returns promise resolving to the last loaded page number
 *
 * @throws {Error} If neither a max page load limit nor a default limit is defined
 * @throws Rejects if the iteration encounters a loading error
 */
export function iteratorNextPageUntilMaxPageLoadLimit(iterator: PageItemIteration, defaultLimit: Maybe<number> = 100): Promise<number> {
  return iteratorNextPageUntilPage(iterator, () => {
    const limit: Maybe<number> = iterator.getMaxPageLoadLimit() ?? defaultLimit;

    if (isMaybeNot(limit)) {
      throw new Error('iteratorNextPageUntilMaxPageLoadLimit() failed. There was no maximum defined.');
    }

    return limit;
  });
}

/**
 * Automatically pages through a {@link PageItemIteration} until the specified page number is reached,
 * respecting the iteration's max page load limit.
 *
 * @param iteration - the page iteration to advance
 * @param page - target page number (or getter returning one) representing total pages to load
 * @returns promise resolving to the last loaded page number
 *
 * @throws Rejects if the iteration encounters a loading error
 */
export function iteratorNextPageUntilPage(iteration: PageItemIteration, page: GetterOrValue<number>): Promise<PageNumber> {
  const getPageLimit = asGetter(page);

  function checkPageLimit(page: PageNumber): boolean {
    const pageLimit = getPageLimit();
    const maxLimit = Math.min(pageLimit, iteration.getMaxPageLoadLimit() ?? Number.MAX_SAFE_INTEGER);
    return page + 1 < maxLimit;
  }

  return new Promise((resolve, reject) => {
    iteration.latestLoadedPage$.pipe(first()).subscribe({
      next: (firstLatestPage: PageNumber) => {
        const promise: Promise<PageNumber> = performTaskLoop<PageNumber>({
          initValue: firstLatestPage,
          checkContinue: async (latestPage: PageNumber) => firstValueFrom(iterationHasNextAndCanLoadMore(iteration)).then((canLoadMore) => canLoadMore && checkPageLimit(latestPage)),
          next: async () => iteration.nextPage()
        });

        resolve(promise);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
