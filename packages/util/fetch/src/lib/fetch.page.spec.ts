import { type PromiseOrValue, type Maybe, randomNumber } from '@dereekb/util';
import { type FetchPage, FetchPageLimitReachedError, type FetchPageResultInfo, type FetchPageResults, fetchPageFactory } from './fetch.page';
import { expectFail, itShouldFail, jestExpectFailAssertErrorType } from '@dereekb/util/test';

interface FetchPageTestRequestObject {
  filter: object;
  page?: Maybe<number>;
  cursor?: Maybe<string>;
}

interface FetchPageTestResultObject {
  data: number[];
  info: FetchPageResultInfo;
}

function testCursorForPage(page: number) {
  return `${page}`;
}

describe('fetchPageFactory()', () => {
  describe('instance', () => {
    const factory = fetchPageFactory<FetchPageTestRequestObject, FetchPageTestResultObject>({
      fetch: async function (input: FetchPageTestRequestObject): Promise<FetchPageTestResultObject> {
        const page = input.page ? input.page : 0;
        return {
          data: [randomNumber(100), randomNumber(100)],
          info: {
            cursor: testCursorForPage(page),
            page
          }
        };
      },
      readFetchPageResultInfo: function (result: FetchPageTestResultObject): PromiseOrValue<Omit<FetchPageResultInfo, 'page'>> {
        return result.info;
      },
      buildInputForNextPage: function (pageResult: Partial<FetchPageResults<FetchPageTestResultObject>>, input: FetchPageTestRequestObject): PromiseOrValue<Maybe<Partial<FetchPageTestRequestObject>>> {
        return {
          page: pageResult?.page != null ? pageResult.page + 1 : 0
        };
      }
    });

    describe('page instance', () => {
      let pageInstance: FetchPage<FetchPageTestRequestObject, FetchPageTestResultObject>;

      beforeEach(() => {
        pageInstance = factory({
          filter: {}
        });
      });

      describe('fetchNext()', () => {
        it('should load the first page', async () => {
          const nextPage = await pageInstance.fetchNext();

          expect(nextPage.previous).toBeUndefined();
          expect(nextPage.page).toBe(0);
          expect(nextPage.cursor).toBe(testCursorForPage(0));
          expect(nextPage.result).toBeDefined();
          expect(nextPage.hasNext).toBe(true); // defaults to true if not provided
        });

        it('should load the second page', async () => {
          const firstPage = await pageInstance.fetchNext();
          const secondPage = await firstPage.fetchNext();

          expect(secondPage.previous).toBe(firstPage);
          expect(secondPage.page).toBe(1);
          expect(secondPage.cursor).toBe(testCursorForPage(1));
          expect(secondPage.result).toBeDefined();
        });

        it('calling fetchNext() again should return the cached result.', async () => {
          const result1 = await pageInstance.fetchNext();
          const result2 = await pageInstance.fetchNext();

          expect(result1.result).toBe(result2.result);
        });

        describe('maxPage', () => {
          itShouldFail('if the limit is exceeded', async () => {
            pageInstance = factory(
              {
                filter: {}
              },
              {
                maxPage: 1
              }
            );

            const firstPage = await pageInstance.fetchNext();
            const secondPage = await firstPage.fetchNext();

            expect(secondPage.isAtMaxPage).toBe(true);

            await expectFail(() => secondPage.fetchNext(), jestExpectFailAssertErrorType(FetchPageLimitReachedError));
          });
        });
      });
    });
  });
});
