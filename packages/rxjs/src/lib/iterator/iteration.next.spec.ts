import { ItemPageIterator, type ItemPageIterationInstance } from './iterator.page';
import { type TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { iteratorNextPageUntilMaxPageLoadLimit, iteratorNextPageUntilPage } from './iteration.next';
import { first, map } from 'rxjs';

describe('iteration.next', () => {
  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;
  let instance: ItemPageIterationInstance<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('iteratorNextPageUntilPage()', () => {
    it('should exit once no more items can be loaded and it is before the target max.', (done) => {
      instance.destroy();

      iterator = new ItemPageIterator({
        loadItemsForPage: (x) => {
          return TEST_PAGE_ITERATOR_DELEGATE.loadItemsForPage(x).pipe(map((x) => ({ ...x, end: true })));
        }
      });

      instance = iterator.instance({});

      const testMaxPagesToLoad = 100;
      const expectedFinalPage = 0;
      instance.setMaxPageLoadLimit(testMaxPagesToLoad);

      iteratorNextPageUntilPage(instance, 10).then((page) => {
        expect(page).toBe(expectedFinalPage);

        instance.numberOfPagesLoaded$.pipe(first()).subscribe((pagesLoaded) => {
          expect(pagesLoaded).toBe(expectedFinalPage + 1);

          instance.hasNextAndCanLoadMore$.pipe(first()).subscribe((hasNextAndCanLoadMore) => {
            expect(hasNextAndCanLoadMore).toBe(false);

            done();
          });
        });
      });
    });

    it('should call next up until the given page is reached.', (done) => {
      const targetPagesToLoad = 10;

      iteratorNextPageUntilPage(instance, targetPagesToLoad).then((page) => {
        expect(page + 1).toBe(targetPagesToLoad);

        instance.numberOfPagesLoaded$.pipe(first()).subscribe((latestPage) => {
          expect(latestPage).toBe(targetPagesToLoad);
          done();
        });
      });
    });

    it(`should call next up until the iterator's limit is reached, even if target page is after.`, (done) => {
      const testMaxPagesToLoad = 5;
      const targetPage = 10;
      instance.setMaxPageLoadLimit(testMaxPagesToLoad);

      iteratorNextPageUntilPage(instance, targetPage).then((page) => {
        expect(page).toBe(testMaxPagesToLoad - 1);

        instance.numberOfPagesLoaded$.pipe(first()).subscribe((page) => {
          expect(page).toBe(instance.getMaxPageLoadLimit());
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

        iteratorNextPageUntilPage(instance, targetPage)
          .then(() => {
            done('should not have returned successfully.');
          })
          .catch((error) => {
            expect(error).toBeDefined();
            done();
          });
      });
    });
  });

  describe('iteratorNextPageUntilMaxPageLoadLimit()', () => {
    it(`should call next up until the iterator's limit is reached.`, (done) => {
      const testMaxPagesToLoad = 15;
      instance.setMaxPageLoadLimit(testMaxPagesToLoad);

      iteratorNextPageUntilMaxPageLoadLimit(instance).then((page) => {
        expect(page).toBe(testMaxPagesToLoad - 1);

        instance.numberOfPagesLoaded$.pipe(first()).subscribe((page) => {
          expect(page).toBe(instance.getMaxPageLoadLimit());
          done();
        });
      });
    });
  });
});
