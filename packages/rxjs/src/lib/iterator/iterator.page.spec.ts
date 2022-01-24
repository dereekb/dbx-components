import { FIRST_PAGE } from '@dereekb/util';
import { ItemPageIterator, ItemPageIteratorDelegate, ItemPageIteratorIterationInstance, ItemPageIteratorRequest, ItemPageIteratorResult } from './iterator.page';
import { loadingStateHasFinishedLoading, loadingStateIsLoading } from '../loading';
import { delay, filter, first, of, Observable, tap } from 'rxjs';
import { iteratorNextPageUntilPage } from './iteration.next';

export interface TestPageIteratorFilter {
  end?: true;
  delayTime?: number;
  resultError?: any;
}

export const TEST_PAGE_ITERATOR_DELEGATE: ItemPageIteratorDelegate<number, TestPageIteratorFilter> = {
  loadItemsForPage: (request: ItemPageIteratorRequest<number, TestPageIteratorFilter>) => {
    const result: ItemPageIteratorResult<number> = {
      value: request.page.page
    };

    let resultObs: Observable<ItemPageIteratorResult<number>> = of(result);

    if (request.page.filter) {
      const { delayTime, resultError, end } = request.page.filter;

      if (delayTime) {
        resultObs = resultObs.pipe(delay(delayTime));
      } else if (resultError) {
        resultObs = of({
          error: resultError
        });
      } else if (end) {
        resultObs = of({
          end: true
        });
      }
    }

    return resultObs;
  }
};

describe('ItemPageIterator', () => {

  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;

  beforeAll(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
  });

  describe('ItemPageIteratorIterationInstance', () => {

    let instance: ItemPageIteratorIterationInstance<number, TestPageIteratorFilter>;

    function initInstanceWithFilter(filter?: TestPageIteratorFilter) {
      instance = iterator.instance({
        filter: filter ?? {}
      });
    }

    beforeEach(() => {
      initInstanceWithFilter();
    });

    it('should return the first page without calling next().', (done) => {

      instance.latestSuccessfulPageResults$.pipe(first()).subscribe((state) => {
        expect(state).toBeDefined();
        expect(loadingStateHasFinishedLoading(state)).toBe(true);
        expect(state.page).toBe(FIRST_PAGE);
        expect(state.model).toBeDefined();

        instance.destroy();
        done();
      });

    });

    describe('successfulPageResultsCount$', () => {

      it('should return 0 before any items have been loaded.', (done) => {
        instance.successfulPageResultsCount$.pipe(first()).subscribe((count) => {
          expect(count).toBe(0);

          instance.destroy();
          done();
        });
      });

      it('should return 1 after the first result has been loaded.', (done) => {

        instance.currentPageResultState$.pipe(
          filter(x => loadingStateHasFinishedLoading(x)),
          first()
        ).subscribe(() => {

          instance.successfulPageResultsCount$.pipe(
            first()
          ).subscribe((count) => {
            expect(count).toBe(1);

            instance.destroy();
            done();
          });
        });
      });

    });

    describe('allItems$', () => {

      it('should return all items after being subscribed to a few pages in.', (done) => {

        const loadPages = 5;

        iteratorNextPageUntilPage(instance, loadPages).then(() => {

          instance.latestPageResultState$.subscribe((latestPage) => {
            expect(latestPage.page).toBe(loadPages);

            instance.allItems$.subscribe((allItems) => {
              expect(allItems).toBeDefined();
              expect(allItems.length).toBe(loadPages + 1);

              instance.destroy();
              done();
            });
          })

        });

      });

      it('should emit only after the first state has come through.', (done) => {

        initInstanceWithFilter({
          delayTime: 500
        });

        let emissions = 0;

        // Should trigger first page to be loaded.
        instance.allItems$.subscribe((allItems) => {
          emissions += 1;

          expect(allItems.length).toBe(1);

          instance.destroy();
          done();
        });

        expect(emissions).toBe(0);
      });

      it('should accumulate values as pages are loaded.', (done) => {

        let emissions = 0;

        let latestAllItems: number[];

        // Should trigger first page to be loaded.
        instance.allItems$.subscribe((allItems) => {
          emissions += 1;
          latestAllItems = allItems;
        });

        const page = 1;

        // Load more pages
        iteratorNextPageUntilPage(instance, page).then(() => {
          expect(emissions).toBe(page + 1);
          expect(latestAllItems.length).toBe(page + 1);

          instance.destroy();
          done();
        });

      });

    });

    describe('next()', () => {

      it('should not do anything if page results are not being subscribed to.', (done) => {

        // Call before subscribing
        instance.next();

        instance.latestSuccessfulPageResults$.pipe(first()).subscribe((state) => {
          expect(state).toBeDefined();
          expect(loadingStateHasFinishedLoading(state)).toBe(true);
          expect(state.page).toBe(FIRST_PAGE);
          expect(state.model).toBeDefined();

          instance.destroy();
          done();
        });

      });

      it('should not trigger another loading if the current page is being loaded.', (done) => {

        initInstanceWithFilter({
          delayTime: 1000
        });

        instance.currentPageResultState$.pipe(
          filter(x => loadingStateIsLoading(x)),
          first()
        ).subscribe((state) => {

          expect(state).toBeDefined();
          expect(loadingStateHasFinishedLoading(state)).toBe(false);

          // Call next
          instance.next();

          of(0).subscribe(() => {
            instance.currentPageResultState$.pipe(
              filter(x => loadingStateHasFinishedLoading(x)),
              first()
            ).subscribe((state) => {
              expect(state).toBeDefined();
              expect(loadingStateHasFinishedLoading(state)).toBe(true);
              expect(state.page).toBe(FIRST_PAGE);
              expect(state.model).toBeDefined();

              instance.destroy();
              done();
            });
          });
        });

      });

      it('should not trigger loading the next page if the current page is done being loaded.', (done) => {

        instance.currentPageResultState$.pipe(
          filter(x => loadingStateHasFinishedLoading(x)),
          first()
        ).subscribe((state) => {

          expect(state).toBeDefined();
          expect(loadingStateHasFinishedLoading(state)).toBe(true);

          instance.currentPageResultState$.pipe(
            filter(x => x.page === FIRST_PAGE && loadingStateHasFinishedLoading(x)),
            tap(() => {

              // Call when loading is finished.
              instance.next();

            }),
            delay(100),
          ).subscribe(() => {
            instance.currentPageResultState$.pipe(first()).subscribe((state) => {
              expect(state).toBeDefined();
              expect(loadingStateHasFinishedLoading(state)).toBe(true);
              expect(state.page).toBe(FIRST_PAGE + 1);
              expect(state.model).toBeDefined();

              instance.destroy();
              done();
            });
          });
        });

        instance.next();

      });

    });

  });

});
