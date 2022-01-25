import { ItemPageIterator, ItemPageIteratorIterationInstance } from './iterator.page';
import { TestPageIteratorFilter, TEST_PAGE_ARRAY_ITERATOR_DELEGATE, TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE } from './iterator.page.spec';
import { iteratorNextPageUntilPage } from './iteration.next';
import { flattenIterationResultItemArray } from './iteration.rxjs';
import { first } from 'rxjs/operators';

describe('iteration.rxjs', () => {

  let iterator: ItemPageIterator<number[], TestPageIteratorFilter>;
  let instance: ItemPageIteratorIterationInstance<number[], TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ARRAY_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('flattenIterationResultItemArray()', () => {

    it(`should aggregate the array of results into a single array.`, (done) => {

      const testPagesToLoad = 10;

      iteratorNextPageUntilPage(instance, testPagesToLoad).then((page) => {
        expect(page).toBe(testPagesToLoad - 1);

        const obs = flattenIterationResultItemArray(instance);

        obs.pipe(first()).subscribe((values) => {
          expect(values.length).toBe(testPagesToLoad * TEST_PAGE_ARRAY_ITERATOR_PAGE_SIZE);
          done();
        });

      });

    });

  });

});
