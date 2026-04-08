import { ItemPageIterator, type ItemPageIterationInstance } from './iterator.page';
import { type TestPageIteratorFilter, TEST_PAGE_ARRAY_ITERATOR_DELEGATE, TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE } from './iterator.page.spec';
import { iteratorNextPageUntilPage } from './iteration.next';
import { accumulatorFlattenPageListLoadingState, flattenAccumulatorResultItemArray } from './iteration.accumulator.rxjs';
import { filter, first, skip } from 'rxjs';
import { itemAccumulator, type ItemAccumulatorInstance } from './iteration.accumulator';
import { type PageItemIteration } from './iteration';
import { isLoadingStateFinishedLoading } from '../loading';
import { callbackTest } from '@dereekb/util/test';

describe('iteration.rxjs', () => {
  let iterator: ItemPageIterator<number[], TestPageIteratorFilter>;
  let iteration: ItemPageIterationInstance<number[], TestPageIteratorFilter>;
  let accumulator: ItemAccumulatorInstance<number[], number[], PageItemIteration<number[]>>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ARRAY_ITERATOR_DELEGATE);
    iteration = iterator.instance({});
    accumulator = itemAccumulator(iteration);
  });

  afterEach(() => {
    iteration.destroy();
    accumulator.destroy();
  });

  describe('flattenAccumulatorResultItemArray()', () => {
    it(
      `should aggregate the array of results into a single array as it loads.`,
      callbackTest((done) => {
        const obs = flattenAccumulatorResultItemArray(accumulator);

        obs
          .pipe(
            filter((x) => x.length >= TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE),
            first()
          )
          .subscribe((values) => {
            expect(Array.isArray(values)).toBe(true);
            expect(Array.isArray(values[0])).toBe(false);

            if (values.length >= TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE) {
              done();
            }
          });

        void iteration.nextPage();
      })
    );

    it(
      `should aggregate the array of results into a single array.`,
      callbackTest((done) => {
        const testPagesToLoad = 10;

        void iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
          expect(page).toBe(testPagesToLoad - 1);

          const obs = flattenAccumulatorResultItemArray(accumulator);

          obs.pipe(first()).subscribe((values) => {
            expect(values.length).toBe(testPagesToLoad * TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE);
            done();
          });
        });
      })
    );

    describe('with mapping', () => {
      let accumulatorWithMapping: ItemAccumulatorInstance<string[], number[], PageItemIteration<number[]>>;

      beforeEach(() => {
        accumulatorWithMapping = itemAccumulator(iteration, (x: number[]) => x.map((y) => String(y)));
      });

      afterEach(() => {
        accumulatorWithMapping.destroy();
      });

      it(`should retain the wrapped accumulator's mapping function.`, (done) => {
        const testPagesToLoad = 10;

        void iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
          expect(page).toBe(testPagesToLoad - 1);

          const obs = flattenAccumulatorResultItemArray(accumulatorWithMapping);

          obs.pipe(first()).subscribe((values) => {
            expect(values.length).toBe(testPagesToLoad * TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE);
            expect(typeof values[0]).toBe('string');
            done();
          });
        });
      });
    });
  });

  describe('next() after end', () => {
    it(
      'should not re-accumulate items when next() is called after the iteration has ended.',
      callbackTest((done) => {
        const maxPageLoadLimit = 1;
        const limitedIteration: ItemPageIterationInstance<number[], TestPageIteratorFilter> = iterator.instance({ maxPageLoadLimit });
        const limitedAccumulator: ItemAccumulatorInstance<number[], number[], PageItemIteration<number[]>> = itemAccumulator(limitedIteration);

        // Load the first (and only allowed) page
        limitedIteration.nextPage().then(() => {
          const obs = flattenAccumulatorResultItemArray(limitedAccumulator);

          obs.pipe(first()).subscribe((valuesBeforeNext) => {
            const countBefore = valuesBeforeNext.length;
            expect(countBefore).toBe(TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE);

            // Call next() after the iteration can't load more — should be a no-op
            limitedIteration.next();

            // Wait a tick for any potential re-emission to propagate
            setTimeout(() => {
              obs.pipe(first()).subscribe((valuesAfterNext) => {
                expect(valuesAfterNext.length).toBe(countBefore);
                limitedIteration.destroy();
                limitedAccumulator.destroy();
                done();
              });
            }, 50);
          });
        });
      })
    );
  });

  describe('accumulatorFlattenPageListLoadingState', () => {
    it(
      `should aggregate the array of results into a single array as the value of the loading state.`,
      callbackTest((done) => {
        const testPagesToLoad = 10;

        void iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
          expect(page).toBe(testPagesToLoad - 1);

          const obs = accumulatorFlattenPageListLoadingState(accumulator);

          obs
            .pipe(
              filter((x) => isLoadingStateFinishedLoading(x)),
              first()
            )
            .subscribe((state) => {
              expect(isLoadingStateFinishedLoading(state)).toBe(true);
              expect(state.value).toBeDefined();
              expect(Array.isArray(state.value)).toBe(true);
              expect(state.page).toBe(testPagesToLoad - 1);
              done();
            });
        });
      })
    );

    it(
      `should return all the values when loading.`,
      callbackTest((done) => {
        void iteratorNextPageUntilPage(iteration, 1).then(() => {
          const obs = accumulatorFlattenPageListLoadingState(accumulator);

          obs
            .pipe(
              //skip the first emission, which is the first page
              skip(1)
            )
            .subscribe((state) => {
              if (!isLoadingStateFinishedLoading(state)) {
                expect(state.value).toBeDefined();
                expect(Array.isArray(state.value)).toBe(true);
              } else {
                expect(state.value).toBeDefined();
                expect(Array.isArray(state.value)).toBe(true);
                done();
              }
            });

          void iteration.next();
        });
      })
    );
  });
});
