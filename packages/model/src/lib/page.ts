import { IterateFn, IteratePageFn, iterate } from '@dereekb/util';

/**
 * Represents a page number.
 */
export interface Page {
  page?: number;
}

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

// MARK: PageCalculator
export interface PageCalculatorConfig {
  pageSize: number;
  limitKey?: string;
  skipKey?: string;
}

/**
 * Page calcuaktion context for calculating the amount to skip/etc.
 */
export class PageCalculator {

  public readonly pageSize: number;
  public readonly limitKey: string;
  public readonly skipKey: string;

  constructor(config: PageCalculatorConfig) {
    this.pageSize = config.pageSize;

    if (!this.pageSize) {
      throw new Error('Page size is required.');
    }

    this.limitKey = config.limitKey ?? 'limit';
    this.skipKey = config.skipKey ?? 'skip';
  }

  get limit() {
    return this.pageSize;
  }

  calcWithPage(page?: Page) {
    return this.calc(page?.page);
  }

  calc(page: number = 0) {
    return {
      [this.limitKey]: this.pageSize,
      [this.skipKey]: this.calcSkip(page)
    };
  }

  calcSkipWithPage(page?: Page) {
    return this.calcSkip(page?.page);
  }

  calcSkip(page: number = 0) {
    return (page ?? 0) * this.pageSize;
  }

}

