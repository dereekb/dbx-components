import { ItemPageIterator, type ItemPageIterationInstance } from './iterator.page';
import { type TestPageIteratorFilter, TEST_PAGE_ARRAY_ITERATOR_DELEGATE, TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE } from './iterator.page.spec';
import { iteratorNextPageUntilPage } from './iteration.next';
import { accumulatorFlattenPageListLoadingState, flattenAccumulatorResultItemArray } from './iteration.accumulator.rxjs';
import { filter, first, skip } from 'rxjs';
import { itemAccumulator, type ItemAccumulatorInstance } from './iteration.accumulator';
import { type PageItemIteration } from './iteration';
import { loadingStateHasFinishedLoading } from '../loading';

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
    it(`should aggregate the array of results into a single array as it loads.`, (done) => {
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

      iteration.nextPage();
    });

    it(`should aggregate the array of results into a single array.`, (done) => {
      const testPagesToLoad = 10;

      iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
        expect(page).toBe(testPagesToLoad - 1);

        const obs = flattenAccumulatorResultItemArray(accumulator);

        obs.pipe(first()).subscribe((values) => {
          expect(values.length).toBe(testPagesToLoad * TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE);
          done();
        });
      });
    });

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

        iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
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

  describe('accumulatorFlattenPageListLoadingState', () => {
    it(`should aggregate the array of results into a single array as the value of the loading state.`, (done) => {
      const testPagesToLoad = 10;

      iteratorNextPageUntilPage(iteration, testPagesToLoad).then((page) => {
        expect(page).toBe(testPagesToLoad - 1);

        const obs = accumulatorFlattenPageListLoadingState(accumulator);

        obs
          .pipe(
            filter((x) => loadingStateHasFinishedLoading(x)),
            first()
          )
          .subscribe((state) => {
            expect(loadingStateHasFinishedLoading(state)).toBe(true);
            expect(state.value).toBeDefined();
            expect(Array.isArray(state.value)).toBe(true);
            expect(state.page).toBe(testPagesToLoad - 1);
            done();
          });
      });
    });

    it(`should return all the values when loading.`, (done) => {
      iteratorNextPageUntilPage(iteration, 1).then(() => {
        const obs = accumulatorFlattenPageListLoadingState(accumulator);

        obs
          .pipe(
            //skip the first emission, which is the first page
            skip(1)
          )
          .subscribe((state) => {
            if (!loadingStateHasFinishedLoading(state)) {
              expect(state.value).toBeDefined();
              expect(Array.isArray(state.value)).toBe(true);
            } else {
              expect(state.value).toBeDefined();
              expect(Array.isArray(state.value)).toBe(true);
              done();
            }
          });

        iteration.next();
      });
    });
  });
});
