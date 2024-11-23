import { type PromiseOrValue, type Maybe, type Page, randomNumberFactory, arrayFactory, reduceNumbersWithAdd } from '@dereekb/util';
import { type FetchPageFactory, type FetchPageFactoryInputOptions, type FetchPageResult, type FetchPageResultInfo, fetchPageFactory } from './fetch.page';
import { type IterateFetchPagesByEachItemFunction, iterateFetchPages, iterateFetchPagesByEachItem, iterateFetchPagesByItems } from './fetch.page.iterate';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';
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

export function fetchPageToPageNumber(defaultReturnAtPage = 3): FetchPageFactory<TestFetchPageInput, TestFetchPage> {
  const randomNumber = randomNumberFactory(1000);
  const randomNumbers = arrayFactory(randomNumber);

  return fetchPageFactory<TestFetchPageInput, TestFetchPage>({
    fetch: async function (input: TestFetchPageInput): Promise<TestFetchPage> {
      const items = randomNumbers(input.itemsPerPage ?? DEFAULT_ITEMS_PER_PAGE);
      const hasNext = (input?.page ?? 0) < (input.returnAtPage ?? defaultReturnAtPage);

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
          jestExpectFailAssertErrorType(TestThrownError)
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
