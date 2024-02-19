import { map, first, type Observable, combineLatest, shareReplay, firstValueFrom, startWith, switchMap, of } from 'rxjs';
import { type ItemIteration, type PageItemIteration } from './iteration';
import { type Maybe, performTaskLoop, reduceBooleansWithAndFn, type GetterOrValue, asGetter, isMaybeNot, PageNumber } from '@dereekb/util';
import { switchMapWhileTrue, tapLog } from '../rxjs';

/**
 * Creates an observable from the input iteration that checks both the hasNext$ and canLoadMore$ states.
 *
 * @param iteration
 * @returns
 */
export function iterationHasNextAndCanLoadMore<V>(iteration: ItemIteration<V>): Observable<boolean> {
  return iteration.canLoadMore$.pipe(
    switchMap((canLoadMore) => {
      if (canLoadMore) {
        return iteration.hasNext$;
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );
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
export function iteratorNextPageUntilPage(iteration: PageItemIteration, page: GetterOrValue<number>): Promise<PageNumber> {
  const getPageLimit = asGetter(page);

  function checkPageLimit(page: PageNumber): boolean {
    const pageLimit = getPageLimit();
    const maxLimit = Math.min(pageLimit, iteration.maxPageLoadLimit ?? Number.MAX_SAFE_INTEGER);
    return page + 1 < maxLimit;
  }

  return new Promise((resolve, reject) => {
    iteration.latestLoadedPage$.pipe(first()).subscribe({
      next: (firstLatestPage: PageNumber) => {
        const promise: Promise<PageNumber> = performTaskLoop<PageNumber>({
          initValue: firstLatestPage,
          checkContinue: async (latestPage: PageNumber) => firstValueFrom(iterationHasNextAndCanLoadMore(iteration)).then((canLoadMore) => canLoadMore && checkPageLimit(latestPage)),
          next: async () => await iteration.nextPage()
        });

        resolve(promise);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
