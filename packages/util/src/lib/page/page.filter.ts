import { type Filter, type OptionalFilter } from '../filter';
import { type PageNumber, type Page } from '../page';
import { type IterateFn, type IteratePageFn, iterate } from '../iterate';

/**
 * Represents a page number with a filter.
 */
export interface FilteredPage<F> extends Page, OptionalFilter<F> {}

/**
 * An object that has a Page and a Filter.
 */
export interface PageAndFilter<F> extends OptionalFilter<F> {
  page: Page;
}

export interface FilteredPageIterateFn<T> {
  /**
   * Uses each value one-by-one.
   */
  use?: IterateFn<T>;
  /**
   * Uses the entire page of results at once.
   */
  usePage?: IteratePageFn<T>;
}

/**
 * Creates a FilteredPage.
 *
 * @param page
 * @param request
 * @returns
 */
export function filteredPage<F = unknown>(page: PageNumber, request?: Filter<F>): FilteredPage<F> {
  return {
    page,
    filter: request?.filter ? { ...request.filter } : undefined
  };
}

/**
 * Iterates using a delegate function sequentially.
 *
 * @param inputPage
 * @param loadFn
 * @param iterFn
 * @returns
 */
export async function iterateFilteredPages<T, F>(inputPage: FilteredPage<F>, loadFn: (page: FilteredPage<F>) => Promise<T[]>, iterFn: FilteredPageIterateFn<T>): Promise<number> {
  let currentPage = inputPage?.page ?? 0;
  let hasMore = true;
  let count = 0;

  if (!iterFn.use && !iterFn.usePage) {
    throw new Error('Neither use nor usePage was specified.');
  }

  const useFn = iterFn.usePage ?? ((values: T[]) => iterate(values, iterFn.use as IterateFn<T>));

  while (hasMore) {
    const page = filteredPage(currentPage, inputPage);
    const values = await loadFn(page);

    await useFn(values);

    count += values.length;
    currentPage += 1;
    hasMore = values.length > 0;
  }

  return count;
}
