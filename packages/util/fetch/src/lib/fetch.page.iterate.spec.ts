import { type PromiseOrValue, type Maybe, type Page, randomNumberFactory, arrayFactory, reduceNumbersWithAdd } from '@dereekb/util';
import { type FetchPageFactory, type FetchPageFactoryInputOptions, type FetchPageResult, type FetchPageResultInfo, fetchPageFactory } from './fetch.page';
import { type IterateFetchPagesByEachItemFunction, iterateFetchPages, iterateFetchPagesByEachItem, iterateFetchPagesByItems } from './fetch.page.iterate';
import { expectFail, itShouldFail, expectFailAssertErrorType } from '@dereekb/util/test';
import { BaseError } from 'make-error';

export const DEFAULT_ITEMS_PER_PAGE = 20;

export interface TestFetchPageInput extends Partial<Page> {
  readonly itemsPerPage?: Maybe<number>;
  readonly returnAtPage?: Maybe<number>;
}

export interface TestFetchPage extends Page {
  readonly items: number[];
  readonly hasNext: boolean;
}

export class TestThrownError extends BaseError {}

/**
 * Creates a {@link FetchPageFactory} that generates test pages up to the specified page number,
 * each containing random numeric items.
 *
 * @param defaultReturnAtPage - the page number at which `hasNext` becomes false (defaults to 3)
 * @returns a configured {@link FetchPageFactory} for testing pagination
 */
export function fetchPageToPageNumber(defaultReturnAtPage = 3): FetchPageFactory<TestFetchPageInput, TestFetchPage> {
  const randomNumber = randomNumberFactory(1000);
  const randomNumbers = arrayFactory(randomNumber);

  return fetchPageFactory<TestFetchPageInput, TestFetchPage>({
    fetch: async function (input: TestFetchPageInput): Promise<TestFetchPage> {
      const items = randomNumbers(input.itemsPerPage ?? DEFAULT_ITEMS_PER_PAGE);
      const hasNext = (input.page ?? 0) < (input.returnAtPage ?? defaultReturnAtPage);

      const result: TestFetchPage = {
        page: input.page ?? 0,
        items,
        hasNext
      };

      return result;
    },
    readFetchPageResultInfo: function (result: TestFetchPage): PromiseOrValue<Omit<FetchPageResultInfo, 'page'>> {
      return { hasNext: result.hasNext };
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<TestFetchPage>>, input: TestFetchPageInput, options: FetchPageFactoryInputOptions): PromiseOrValue<Maybe<Partial<TestFetchPageInput>>> {
      return { ...input, page: (input.page ?? 0) + 1 };
    }
  });
}
describe('iterateFetchPagesByEachItem()', () => {
  const iterateEachPageItem: IterateFetchPagesByEachItemFunction<TestFetchPageInput, TestFetchPage, number, number> = async function (item: number, index: number, result: FetchPageResult<TestFetchPage>): Promise<number> {
    return item;
  };

  const readItemsFromPageResult = (x: FetchPageResult<TestFetchPage>) => x.result.items;

  describe('instance', () => {
    describe('iterateEachPageItem', () => {
      itShouldFail('if an item throws an error', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        await expectFail(
          () =>
            iterateFetchPagesByEachItem({
              readItemsFromPageResult,
              input: {},
              fetchPageFactory,
              iterateEachPageItem: () => {
                throw new TestThrownError('test');
              }
            }),
          expectFailAssertErrorType(TestThrownError)
        );
      });
    });

    describe('maxPage', () => {
      it('should iterate up to the max page', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const maxPage = 2;
        const result = await iterateFetchPagesByEachItem({
          readItemsFromPageResult,
          input: {},
          maxPage,
          fetchPageFactory,
          iterateEachPageItem
        });

        expect(result.totalPages).toBe(maxPage + 1);
        expect(result.totalPagesLimitReached).toBe(true);
      });
    });

    describe('loadItemLimit', () => {
      it('should iterate up to number of items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const loadItemLimit = 20;
        const expectedTotalPages = Math.ceil(loadItemLimit / DEFAULT_ITEMS_PER_PAGE);

        let itemsVisited = 0;

        const maxPage = expectedTotalPages * 2;
        const result = await iterateFetchPagesByEachItem({
          readItemsFromPageResult,
          loadItemLimit,
          input: {},
          maxPage,
          fetchPageFactory,
          iterateEachPageItem: async (item: number) => {
            itemsVisited += 1;
            return item;
          }
        });

        expect(itemsVisited).toBe(expectedTotalPages * DEFAULT_ITEMS_PER_PAGE);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      it('should iterate up to number of filtered items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const loadItemLimit = 20;
        const expectedTotalPages = 1;

        let itemsVisited = 0;

        const result = await iterateFetchPagesByEachItem({
          readItemsFromPageResult,
          loadItemLimit,
          input: {},
          fetchPageFactory,
          iterateEachPageItem: async (item: number) => {
            itemsVisited += 1;
            return item;
          },
          filterPageItems: (x) => {
            return [x[0]]; // only take one
          }
        });

        expect(itemsVisited).toBe(1);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });
    });

    describe('iterateItemsLimit', () => {
      it('should iterate up to number of items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const iterateItemsLimit = 20;
        const expectedTotalPages = Math.ceil(iterateItemsLimit / DEFAULT_ITEMS_PER_PAGE);

        let itemsVisited = 0;

        const maxPage = expectedTotalPages * 2;
        const result = await iterateFetchPagesByEachItem({
          readItemsFromPageResult,
          iterateItemsLimit,
          input: {},
          maxPage,
          fetchPageFactory,
          iterateEachPageItem: async (item: number) => {
            itemsVisited += 1;
            return item;
          }
        });

        expect(itemsVisited).toBe(expectedTotalPages * DEFAULT_ITEMS_PER_PAGE);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      it('should iterate up to number of filtered items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const iterateItemsLimit = 20;
        const expectedTotalPages = iterateItemsLimit;

        let itemsVisited = 0;

        const result = await iterateFetchPagesByEachItem({
          readItemsFromPageResult,
          iterateItemsLimit,
          input: {},
          fetchPageFactory,
          iterateEachPageItem: async (item: number) => {
            itemsVisited += 1;
            return item;
          },
          filterPageItems: (x) => {
            return [x[0]]; // only take one
          }
        });

        expect(itemsVisited).toBe(iterateItemsLimit);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      describe('with max page', () => {
        it('should iterate up to the max page limit', async () => {
          const fetchPageFactory = fetchPageToPageNumber(100);

          const iterateItemsLimit = 20;

          let itemsVisited = 0;

          const maxPage = 2;
          const result = await iterateFetchPagesByEachItem({
            readItemsFromPageResult,
            iterateItemsLimit,
            input: {},
            maxPage,
            fetchPageFactory,
            iterateEachPageItem: async (item: number) => {
              itemsVisited += 1;
              return item;
            },
            filterPageItems: (x) => {
              return [x[0]]; // only take one
            }
          });

          expect(itemsVisited).toBe(maxPage + 1);
          expect(result.totalPages).toBe(maxPage + 1);
          expect(result.totalPagesLimitReached).toBe(true);
        });
      });
    });
  });
});

describe('iterateFetchPagesByItems()', () => {
  const iteratePageItems = async function (items: number[], result: FetchPageResult<TestFetchPage>): Promise<number[]> {
    return items;
  };

  const readItemsFromPageResult = (x: FetchPageResult<TestFetchPage>) => x.result.items;

  describe('instance', () => {
    describe('maxPage', () => {
      it('should iterate up to the max page', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const maxPage = 2;
        const result = await iterateFetchPagesByItems({
          readItemsFromPageResult,
          input: {},
          maxPage,
          fetchPageFactory,
          iteratePageItems
        });

        expect(result.totalPages).toBe(maxPage + 1);
        expect(result.totalPagesLimitReached).toBe(true);
      });
    });

    describe('loadItemLimit', () => {
      it('should iterate up to number of items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const loadItemLimit = 20;
        const expectedTotalPages = Math.ceil(loadItemLimit / DEFAULT_ITEMS_PER_PAGE);

        let itemsVisited = 0;

        const maxPage = expectedTotalPages * 2;
        const result = await iterateFetchPagesByItems({
          readItemsFromPageResult,
          loadItemLimit,
          input: {},
          maxPage,
          fetchPageFactory,
          iteratePageItems: async (items: number[]) => {
            itemsVisited += items.length;
            return items;
          }
        });

        expect(itemsVisited).toBe(expectedTotalPages * DEFAULT_ITEMS_PER_PAGE);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      it('should iterate up to number of filtered items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const loadItemLimit = 20;
        const expectedTotalPages = 1;

        let itemsVisited = 0;

        const result = await iterateFetchPagesByItems({
          readItemsFromPageResult,
          loadItemLimit,
          input: {},
          fetchPageFactory,
          iteratePageItems: async (items: number[]) => {
            itemsVisited += items.length;
            return items;
          },
          filterPageItems: (x) => {
            return [x[0]]; // only take one
          }
        });

        expect(itemsVisited).toBe(1);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });
    });

    describe('iterateItemsLimit', () => {
      it('should iterate up to number of items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const iterateItemsLimit = 20;
        const expectedTotalPages = Math.ceil(iterateItemsLimit / DEFAULT_ITEMS_PER_PAGE);

        let itemsVisited = 0;

        const maxPage = expectedTotalPages * 2;
        const result = await iterateFetchPagesByItems({
          readItemsFromPageResult,
          iterateItemsLimit,
          input: {},
          maxPage,
          fetchPageFactory,
          iteratePageItems: async (items: number[]) => {
            itemsVisited += items.length;
            return items;
          }
        });

        expect(itemsVisited).toBe(expectedTotalPages * DEFAULT_ITEMS_PER_PAGE);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      it('should iterate up to number of filtered items limited', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const iterateItemsLimit = 20;
        const expectedTotalPages = iterateItemsLimit;

        let itemsVisited = 0;

        const result = await iterateFetchPagesByItems({
          readItemsFromPageResult,
          iterateItemsLimit,
          input: {},
          fetchPageFactory,
          iteratePageItems: async (items: number[]) => {
            itemsVisited += items.length;
            return items;
          },
          filterPageItems: (x) => {
            return [x[0]]; // only take one
          }
        });

        expect(itemsVisited).toBe(iterateItemsLimit);
        expect(result.totalPages).toBe(expectedTotalPages);
        expect(result.totalPagesLimitReached).toBe(false);
      });

      describe('with max page', () => {
        it('should iterate up to the max page limit', async () => {
          const fetchPageFactory = fetchPageToPageNumber(100);

          const iterateItemsLimit = 20;

          let itemsVisited = 0;

          const maxPage = 2;
          const result = await iterateFetchPagesByItems({
            readItemsFromPageResult,
            iterateItemsLimit,
            input: {},
            maxPage,
            fetchPageFactory,
            iteratePageItems: async (items: number[]) => {
              itemsVisited += items.length;
              return items;
            },
            filterPageItems: (x) => {
              return [x[0]]; // only take one
            }
          });

          expect(itemsVisited).toBe(maxPage + 1);
          expect(result.totalPages).toBe(maxPage + 1);
          expect(result.totalPagesLimitReached).toBe(true);
        });
      });
    });
  });
});

describe('iterateFetchPages()', () => {
  const iteratePage = async function (result: FetchPageResult<TestFetchPage>): Promise<number> {
    return reduceNumbersWithAdd(result.result.items);
  };

  describe('instance', () => {
    describe('maxPage', () => {
      it('should iterate up to the max page', async () => {
        const fetchPageFactory = fetchPageToPageNumber(100);

        const maxPage = 2;
        const result = await iterateFetchPages({
          input: {},
          maxPage,
          fetchPageFactory,
          iteratePage
        });

        expect(result.totalPages).toBe(maxPage + 1);
        expect(result.totalPagesLimitReached).toBe(true);
      });

      it('should iterate up to running out of pages of content to load', async () => {
        const expectedMatchPage = 1;
        const fetchPageFactory = fetchPageToPageNumber(expectedMatchPage);

        const maxPage = 2;
        const result = await iterateFetchPages({
          input: {},
          maxPage,
          fetchPageFactory,
          iteratePage
        });

        expect(result.totalPages).toBe(expectedMatchPage + 1);
        expect(result.totalPagesLimitReached).toBe(false);
      });
    });
  });
});

/**
 * Creates a {@link FetchPageFactory} that always reports `hasNext: true` but stops producing input
 * for the next page after the input page number, so `fetchNext()` throws a {@link FetchPageNoNextPageError}.
 *
 * This mirrors the shape of a cursor-based API (Discord's message pagination, for example) that can
 * only detect the end of the results by seeing a short final page.
 *
 * @param finalPage - the page number after which no further input is produced
 * @returns a configured {@link FetchPageFactory} for testing pagination
 */
export function fetchPageWithNoNextPageInputAfter(finalPage: number): FetchPageFactory<TestFetchPageInput, TestFetchPage> {
  const randomNumber = randomNumberFactory(1000);
  const randomNumbers = arrayFactory(randomNumber);

  return fetchPageFactory<TestFetchPageInput, TestFetchPage>({
    fetch: async function (input: TestFetchPageInput): Promise<TestFetchPage> {
      return {
        page: input.page ?? 0,
        items: randomNumbers(input.itemsPerPage ?? DEFAULT_ITEMS_PER_PAGE),
        hasNext: true
      };
    },
    readFetchPageResultInfo: function (): PromiseOrValue<Omit<FetchPageResultInfo, 'page'>> {
      return { hasNext: true }; // always claims there is a next page
    },
    buildInputForNextPage: function (pageResult: Partial<FetchPageResult<TestFetchPage>>, input: TestFetchPageInput): PromiseOrValue<Maybe<Partial<TestFetchPageInput>>> {
      const page = input.page ?? 0;
      return page >= finalPage ? undefined : { ...input, page: page + 1 };
    }
  });
}

describe('iterateFetchPages() with a page source that only signals the end by throwing', () => {
  const iteratePage = async function (result: FetchPageResult<TestFetchPage>): Promise<number> {
    return reduceNumbersWithAdd(result.result.items);
  };

  it('should settle when fetchNext() throws a FetchPageNoNextPageError', async () => {
    const finalPage = 2;
    const fetchPageFactory = fetchPageWithNoNextPageInputAfter(finalPage);

    const result = await iterateFetchPages({
      input: {},
      maxPage: null,
      fetchPageFactory,
      iteratePage
    });

    expect(result.totalPages).toBe(finalPage + 1);
    expect(result.totalPagesLimitReached).toBe(false);
  });

  it('should settle when iterating by items', async () => {
    const finalPage = 2;
    const fetchPageFactory = fetchPageWithNoNextPageInputAfter(finalPage);

    const result = await iterateFetchPagesByItems({
      readItemsFromPageResult: (x: FetchPageResult<TestFetchPage>) => x.result.items,
      input: {},
      maxPage: null,
      fetchPageFactory,
      iteratePageItems: async (items: number[]) => items
    });

    expect(result.totalPages).toBe(finalPage + 1);
    expect(result.totalItemsLoaded).toBe((finalPage + 1) * DEFAULT_ITEMS_PER_PAGE);
  });
});

describe('iterateFetchPagesByItems() endEarly', () => {
  const readItemsFromPageResult = (x: FetchPageResult<TestFetchPage>) => x.result.items;

  it('should use the endEarly provided in the config', async () => {
    const fetchPageFactory = fetchPageToPageNumber(100);

    let visitedPages = 0;

    const result = await iterateFetchPagesByItems({
      readItemsFromPageResult,
      input: {},
      fetchPageFactory,
      iteratePageItems: async (items: number[]) => {
        visitedPages += 1;
        return items;
      },
      endEarly: ({ i }) => i >= 1 // stop after the second page
    });

    expect(visitedPages).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.totalItemsLoaded).toBe(2 * DEFAULT_ITEMS_PER_PAGE);
  });

  it('should still end early on the item limit when an endEarly is provided', async () => {
    const fetchPageFactory = fetchPageToPageNumber(100);
    const loadItemLimit = DEFAULT_ITEMS_PER_PAGE;

    const result = await iterateFetchPagesByItems({
      readItemsFromPageResult,
      input: {},
      loadItemLimit,
      fetchPageFactory,
      iteratePageItems: async (items: number[]) => items,
      endEarly: () => false
    });

    expect(result.totalPages).toBe(1);
    expect(result.totalItemsLoaded).toBe(loadItemLimit);
  });
});
