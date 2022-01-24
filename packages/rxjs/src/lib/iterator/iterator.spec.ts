import { FIRST_PAGE } from '@dereekb/util';
import { ItemPageIterator, ItemPageIteratorDelegate, ItemPageIteratorIterationInstance, ItemPageIteratorRequest, ItemPageIteratorResult } from './iterator';
import { loadingStateHasFinishedLoading, loadingStateIsLoading } from '../loading';
import { delay, filter, first, of, Observable, tap } from 'rxjs';

interface TestPageIteratorFilter {
  end?: true;
  delayTime?: number;
  resultError?: any;
}

const delegate: ItemPageIteratorDelegate<number, TestPageIteratorFilter> = {
  loadItemsForPage: (request: ItemPageIteratorRequest<number, TestPageIteratorFilter>) => {
    const result: ItemPageIteratorResult<number> = {
      values: request.page.page
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
    iterator = new ItemPageIterator(delegate);
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
        done();
      });

    });

    describe('successfulPageResultsCount$', () => {

      it('should return 0 before any items have been loaded.', (done) => {
        instance.successfulPageResultsCount$.pipe(first()).subscribe((count) => {
          expect(count).toBe(0);
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
            done();
          });
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
              done();
            });
          });
        });

        instance.next();

      });

    });

    describe('nextUntilPage()', () => {

      it('should call next up until the given page is reached.', (done) => {

        const targetPage = 10;

        instance.nextUntilPage(targetPage).then(() => {

          instance.latestPageResultPage$.subscribe((page) => {
            expect(page).toBe(targetPage);
            done();
          });

        });

      });

    });

    describe('nextUntilLimit()', () => {

      it(`should call next up until the iterator's limit is reached.`, (done) => {

        instance.maxPageLoadLimit = 15;

        instance.nextUntilLimit().then(() => {

          instance.latestPageResultPage$.subscribe((page) => {
            expect(page).toBe(instance.maxPageLoadLimit);
            done();
          });

        });

      });

    });

  });

});
