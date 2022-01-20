import { IterateFn, IteratePageFn, iterate, Page } from '@dereekb/util';

/**
 * Represents a page number with a filter.
 */
export interface FilteredPage<F> extends Page {
  filter?: F;
}

/**
 * A page with a filter.
 */
export interface PageAndFilter<F> {
  page: Page;
  filter?: F;
}

export interface FilteredPageIterateFn<T> {
  /**
   * Uses each model one-by-one.
   */
  use?: IterateFn<T>;
  /**
   * Uses the entire page of results at once.
   */
  usePage?: IteratePageFn<T>;
}

export class FilteredPageUtility {

  static filter<F = any>(filter: F, request?: FilteredPage<F>) {
    return {
      page: request?.page,
      filter: Object.assign({}, request?.filter, filter)
    };
  }

  static page<F = any>(page: number, request?: FilteredPage<F>) {
    return {
      page,
      filter: Object.assign({}, request?.filter)
    };
  }

  static async iterate<T, F>(inputPage: FilteredPage<F>, loadFn: (page: FilteredPage<F>) => Promise<T[]>, useConfig: FilteredPageIterateFn<T>): Promise<number> {
    let currentPage = inputPage?.page ?? 0;
    let hasMore = true;
    let count = 0;

    if (!useConfig.use && !useConfig.usePage) {
      throw new Error('Neither use nor usePage was specified.');
    }

    const useFn = useConfig.usePage ?? ((values: T[]) => iterate(values, useConfig.use!));

    while (hasMore) {
      const page = FilteredPageUtility.page(currentPage, inputPage);
      const values = await loadFn(page);

      await useFn(values);

      count += values.length;
      currentPage += 1;
      hasMore = values.length > 0;
    }

    return count;
  }

}
