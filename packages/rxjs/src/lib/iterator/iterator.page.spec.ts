import { FIRST_PAGE, type PageNumber, range } from '@dereekb/util';
import { ItemPageIterator, type ItemPageIteratorDelegate, type ItemPageIterationInstance, type ItemPageIteratorRequest, type ItemPageIteratorResult } from './iterator.page';
import { loadingStateHasFinishedLoading, loadingStateIsLoading } from '../loading';
import { skip, delay, filter, first, of, type Observable, tap } from 'rxjs';

export interface TestPageIteratorFilter {
  end?: true;
  delayTime?: number;
  resultError?: any;
}

export function makeTestPageIteratorDelegate<T>(makeResultsFn: (page: PageNumber) => T): ItemPageIteratorDelegate<T, TestPageIteratorFilter> {
  return {
    loadItemsForPage: (request: ItemPageIteratorRequest<T, TestPageIteratorFilter>) => {
      const result: ItemPageIteratorResult<T> = {
        value: makeResultsFn(request.page)
      };

      let resultObs: Observable<ItemPageIteratorResult<T>> = of(result);

      if (request.iteratorConfig.filter) {
        const { delayTime, resultError, end } = request.iteratorConfig.filter ?? {};

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
}

/**
 * Returns a number each time equivalent to the page being loaded.
 */
export const TEST_PAGE_ITERATOR_DELEGATE: ItemPageIteratorDelegate<number, TestPageIteratorFilter> = makeTestPageIteratorDelegate((page) => page);

export const TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE = 10;

/**
 * Loads an array of numbers each time
 */
export const TEST_PAGE_ARRAY_ITERATOR_DELEGATE: ItemPageIteratorDelegate<number[], TestPageIteratorFilter> = makeTestPageIteratorDelegate((page) => {
  const start = page * TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE;
  const end = start + TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE;
  return range({ start, end });
});

describe('ItemPageIterator', () => {
  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
  });

  describe('ItemPageIterationInstance', () => {
    let instance: ItemPageIterationInstance<number, TestPageIteratorFilter>;

    function initInstanceWithFilter(filter?: TestPageIteratorFilter) {
      instance = iterator.instance({
        filter: filter ?? {}
      });
    }

    beforeEach(() => {
      initInstanceWithFilter();
    });

    afterEach(() => {
      instance.destroy();
    });

    it('should return the first page without calling next().', (done) => {
      instance.latestSuccessfulPageResults$.pipe(first()).subscribe((state) => {
        expect(state).toBeDefined();
        expect(loadingStateHasFinishedLoading(state)).toBe(true);
        expect(state.page).toBe(FIRST_PAGE);
        expect(state.value).toBeDefined();

        done();
      });
    });

    describe('_nextTrigger$', () => {
      it('should not emit a value until next is called.', (done) => {
        let expected = false;

        instance._nextTrigger$.pipe(first()).subscribe(() => {
          expect(expected).toBe(true);
          done();
        });

        expected = true;

        instance.next();
      });

      it('should emit a value when n changes.', (done) => {
        instance._nextFinished$.pipe(first()).subscribe((state) => {
          expect(state.n).toBe(0);

          let expected = false;

          instance._nextTrigger$.pipe(first()).subscribe((state) => {
            expect(expected).toBe(true);
            expect(state.n).toBe(1);

            instance.destroy();
            done();
          });

          expected = true;
          instance.next();
        });
      });
    });

    describe('_nextFinished$', () => {
      it('should emit a value when the state is in an error state and retry is not presented.', (done) => {
        initInstanceWithFilter({ resultError: new Error() });

        instance.latestPageResultState$.pipe(first()).subscribe((latest) => {
          expect(latest.error).toBeDefined();

          let expected = false;

          instance._nextFinished$.pipe(first()).subscribe(() => {
            expect(expected).toBe(true);
            done();
          });

          expected = true;

          instance.next();
        });
      });

      it('should not emit a value until next is called.', (done) => {
        let expected = false;

        instance._nextFinished$.pipe(first()).subscribe(() => {
          expect(expected).toBe(true);
          done();
        });

        expected = true;

        instance.next();
      });

      it('should not emit a value until the state has finished loading after next() is called.', (done) => {
        instance._nextFinished$.pipe(first()).subscribe((state) => {
          expect(loadingStateHasFinishedLoading(state.current)).toBe(true);
          done();
        });

        instance.next();
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
          expect(state.value).toBeDefined();

          done();
        });
      });

      it('should not trigger another loading if the current page is being loaded.', (done) => {
        initInstanceWithFilter({
          delayTime: 1000
        });

        instance.currentPageResultState$
          .pipe(
            filter((x) => loadingStateIsLoading(x)),
            first()
          )
          .subscribe((state) => {
            expect(state).toBeDefined();
            expect(loadingStateHasFinishedLoading(state)).toBe(false);

            // Call next
            instance.next();

            of(0).subscribe(() => {
              instance.currentPageResultState$
                .pipe(
                  filter((x) => loadingStateHasFinishedLoading(x)),
                  first()
                )
                .subscribe((state) => {
                  expect(state).toBeDefined();
                  expect(loadingStateHasFinishedLoading(state)).toBe(true);
                  expect(state.page).toBe(FIRST_PAGE);
                  expect(state.value).toBeDefined();

                  done();
                });
            });
          });
      });

      it('should trigger loading the next page if the current page is done being loaded.', (done) => {
        instance.currentPageResultState$
          .pipe(
            filter((x) => loadingStateHasFinishedLoading(x)),
            first()
          )
          .subscribe((state) => {
            // First page loads upon first subscription.

            expect(state).toBeDefined();
            expect(loadingStateHasFinishedLoading(state)).toBe(true);

            instance.currentPageResultState$
              .pipe(
                filter((x) => x.page === FIRST_PAGE && loadingStateHasFinishedLoading(x)),
                tap(() => {
                  // Call when loading is finished.
                  instance.next();
                }),
                delay(100)
              )
              .subscribe(() => {
                instance.currentPageResultState$.pipe(first()).subscribe((state) => {
                  expect(state).toBeDefined();
                  expect(loadingStateHasFinishedLoading(state)).toBe(true);
                  expect(state.page).toBe(FIRST_PAGE + 1);
                  expect(state.value).toBeDefined();

                  done();
                });
              });
          });
      });

      it('state$ should return the previous error/state.', (done) => {
        initInstanceWithFilter({ resultError: new Error() });

        instance.latestPageResultState$.pipe(first()).subscribe((latestState) => {
          expect(latestState.error).toBeDefined();

          // Wait for next state triggered by next.
          instance.state$.pipe(skip(1), first()).subscribe((newState) => {
            expect(newState.latestFinished).toBe(latestState);

            done();
          });

          instance.next();
        });
      });
    });

    describe('nextPage()', () => {
      it('should trigger loading the next page.', (done) => {
        instance.latestPageResultState$
          .pipe(
            filter((x) => loadingStateHasFinishedLoading(x)),
            first()
          )
          .subscribe((state) => {
            expect(state.page).toBe(FIRST_PAGE);

            instance.nextPage().then((loadedPage) => {
              expect(loadedPage).toBe(FIRST_PAGE + 1);

              instance.currentPageResultState$
                .pipe(
                  filter((x) => loadingStateHasFinishedLoading(x)),
                  first()
                )
                .subscribe((currentState) => {
                  expect(currentState.page).toBe(FIRST_PAGE + 1);
                  done();
                });
            });
          });
      });

      it('should return the current error.', (done) => {
        initInstanceWithFilter({ resultError: new Error() });

        instance.latestPageResultState$.pipe(first()).subscribe((latest) => {
          expect(latest.error).toBeDefined();

          instance.nextPage().then(
            () => {
              done('next should have failed');
            },
            (error) => {
              expect(error).toBeDefined();
              done();
            }
          );
        });
      });
    });

    describe('first nextPage()', () => {
      it('should return page 0 if next page is called before any value is loaded.', async () => {
        const page = await instance.nextPage();
        expect(page).toBe(0);
      });

      it('should return page 1 if next page is called before any value is loaded.', (done) => {
        instance.latestLoadedPage$.pipe(first()).subscribe((page) => {
          expect(page).toBe(FIRST_PAGE);

          instance.nextPage().then((nextPage) => {
            expect(nextPage).toBe(1);
            done();
          });
        });
      });
    });
  });
});
