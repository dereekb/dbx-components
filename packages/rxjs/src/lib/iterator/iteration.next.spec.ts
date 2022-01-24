import { ItemPageIterator, ItemPageIteratorIterationInstance } from './iterator.page';
import { TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { iteratorNextPageUntilMaxPageLoadLimit, iteratorNextPageUntilPage } from './iteration.next';

describe('iteration.next', () => {

  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;
  let instance: ItemPageIteratorIterationInstance<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  describe('nextUntilPage()', () => {

    it('should call next up until the given page is reached.', (done) => {

      const targetPage = 10;

      iteratorNextPageUntilPage(instance, targetPage).then(() => {

        instance.latestLoadedPage$.subscribe((page) => {
          expect(page).toBe(targetPage);
          done();
        });

      });

    });

    it(`should call next up until the iterator's limit is reached, even if target page is after.`, (done) => {

      const targetPage = 10;
      instance.maxPageLoadLimit = 5;

      iteratorNextPageUntilPage(instance, targetPage).then(() => {

        instance.latestLoadedPage$.subscribe((page) => {
          expect(page).toBe(instance.maxPageLoadLimit);
          done();
        });

      });

    });

  });

  describe('iteratorNextPageUntilLimit()', () => {

    it(`should call next up until the iterator's limit is reached.`, (done) => {

      instance.maxPageLoadLimit = 15;

      iteratorNextPageUntilMaxPageLoadLimit(instance).then(() => {

        instance.latestLoadedPage$.subscribe((page) => {
          expect(page).toBe(instance.maxPageLoadLimit);
          done();
        });

      });

    });

  });

});
