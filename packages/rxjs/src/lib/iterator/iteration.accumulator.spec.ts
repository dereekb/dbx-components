import { PageNumber, range } from '@dereekb/util';
import { skip } from 'rxjs/operators';
import { FIRST_PAGE } from '@dereekb/util';
import { ItemPageIterator, ItemPageIteratorDelegate, ItemPageIteratorIterationInstance, ItemPageIteratorRequest, ItemPageIteratorResult } from './iterator.page';
import { loadingStateHasFinishedLoading, loadingStateIsLoading } from '../loading';
import { delay, filter, first, of, Observable, tap } from 'rxjs';
import { iteratorNextPageUntilPage } from './iteration.next';
import { ItemIterationAccumulatorInstance } from './iteration.accumulator';
import { TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';

describe('ItemPageIterator', () => {

  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
  });

  describe('ItemIterationAccumulatorInstance', () => {

    let instance: ItemPageIteratorIterationInstance<number, TestPageIteratorFilter>;
    let accumulator: ItemIterationAccumulatorInstance<number>;

    function initInstanceWithFilter(filter?: TestPageIteratorFilter) {
      instance = iterator.instance({
        filter: filter ?? {}
      });
      accumulator = new ItemIterationAccumulatorInstance(instance);
    }

    beforeEach(() => {
      initInstanceWithFilter();
    });

    afterEach(() => {
      instance.destroy();
      accumulator.destroy();
    });

    describe('successfulLoadCount$', () => {

      it('should return 1 after the first result has been loaded.', (done) => {

        instance.currentPageResultState$.pipe(
          filter(x => loadingStateHasFinishedLoading(x)),
          first()
        ).subscribe(() => {

          accumulator.successfulLoadCount$.pipe(
            first()
          ).subscribe((count) => {
            expect(count).toBe(1);
            done();
          });
        });
      });

    });

    describe('allItems$', () => {

      it('should return all items after being subscribed to a few pages in.', (done) => {

        const pagesToLoad = 5;

        iteratorNextPageUntilPage(instance, pagesToLoad).then(() => {

          instance.numberOfPagesLoaded$.subscribe((pagesLoaded) => {
            expect(pagesLoaded).toBe(pagesToLoad);

            accumulator.allItems$.subscribe((allItems) => {
              expect(allItems).toBeDefined();
              expect(allItems.length).toBe(pagesToLoad);

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
        accumulator.allItems$.subscribe((allItems) => {
          emissions += 1;

          expect(allItems.length).toBe(1);

          done();
        });

        expect(emissions).toBe(0);
      });

      it('should accumulate values as pages are loaded.', (done) => {

        let emissions = 0;
        let latestAllItems: number[];

        // Should trigger first page to be loaded.
        accumulator.allItems$.subscribe((allItems) => {
          emissions += 1;
          latestAllItems = allItems;
        });

        const page = 1;

        // Load more pages
        iteratorNextPageUntilPage(instance, page).then(() => {
          expect(emissions).toBe(page);
          expect(latestAllItems.length).toBe(page);
          done();
        });

      });

    });

  });

});
