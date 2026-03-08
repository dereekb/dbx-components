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

/**
 * Callbacks for iterating over paged results. Provide either `use` (per-item) or `usePage` (per-page).
 */
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
 * Creates a {@link FilteredPage} combining a page number with an optional filter copied from the request.
 *
 * @param page - The page number
 * @param request - Optional filter to copy into the result
 * @returns A new filtered page object
 */
export function filteredPage<F = unknown>(page: PageNumber, request?: Filter<F>): FilteredPage<F> {
  return {
    page,
    filter: request?.filter ? { ...request.filter } : undefined
  };
}

/**
 * Sequentially loads and iterates through pages of results until an empty page is returned.
 *
 * Starts from the given page and increments the page number after each load. Stops when
 * `loadFn` returns an empty array. Either `iterFn.use` or `iterFn.usePage` must be provided.
 *
 * @param inputPage - Starting page with optional filter
 * @param loadFn - Async function that loads a page of results
 * @param iterFn - Callbacks for processing each item or page
 * @returns The total number of items processed across all pages
 * @throws Error if neither `use` nor `usePage` is specified in `iterFn`
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
