import { ItemPageIterator, ItemPageIteratorIterationInstance } from './iterator.page';
import { TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { iteratorNextPageUntilMaxPageLoadLimit, iteratorNextPageUntilPage } from './iteration.next';
import { first } from 'rxjs/operators';

describe('iteration.next', () => {

  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;
  let instance: ItemPageIteratorIterationInstance<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('nextUntilPage()', () => {

    it('should call next up until the given page is reached.', (done) => {
      const targetPage = 10;

      iteratorNextPageUntilPage(instance, targetPage).then((page) => {
        expect(page).toBe(targetPage);

        instance.latestLoadedPage$.pipe(first()).subscribe((latestPage) => {

          expect(latestPage).toBe(targetPage);
          done();
        });
      });

    });

    it(`should call next up until the iterator's limit is reached, even if target page is after.`, (done) => {

      const testLimit = 5;
      const targetPage = 10;
      instance.maxPageLoadLimit = testLimit;

      iteratorNextPageUntilPage(instance, targetPage).then((page) => {
        expect(page).toBe(testLimit);

        instance.latestLoadedPage$.pipe(first()).subscribe((page) => {
          expect(page).toBe(instance.maxPageLoadLimit);
          done();
        });

      });

    });

    describe('with error', () => {

      beforeEach(() => {
        instance = iterator.instance({
          filter: {
            resultError: new Error()
          }
        });
      });

      it('should return with the error.', (done) => {
        const targetPage = 10;

        iteratorNextPageUntilPage(instance, targetPage).then(() => {
          done('should not have returned successfully.');
        }).catch((error) => {
          expect(error).toBeDefined();
          done();
        });
      });

    });

  });

  describe('iteratorNextPageUntilLimit()', () => {

    it(`should call next up until the iterator's limit is reached.`, (done) => {

      const testLimit = 15;
      instance.maxPageLoadLimit = testLimit;

      iteratorNextPageUntilMaxPageLoadLimit(instance).then((page) => {
        expect(page).toBe(testLimit);

        instance.latestLoadedPage$.pipe(first()).subscribe((page) => {
          expect(page).toBe(instance.maxPageLoadLimit);
          done();
        });

      });

    });

  });

});
