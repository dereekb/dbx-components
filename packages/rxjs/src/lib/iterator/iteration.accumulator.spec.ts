import { SubscriptionObject } from './../subscription';
import { ItemPageIterator, ItemPageIterationInstance } from './iterator.page';
import { loadingStateHasFinishedLoading } from '../loading';
import { filter, first, skip } from 'rxjs';
import { iteratorNextPageUntilPage } from './iteration.next';
import { itemAccumulator, ItemAccumulatorInstance } from './iteration.accumulator';
import { TestPageIteratorFilter, TEST_PAGE_ARRAY_ITERATOR_DELEGATE, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';

describe('ItemPageIterator', () => {

  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
  });

  describe('ItemAccumulatorInstance', () => {

    let instance: ItemPageIterationInstance<number, TestPageIteratorFilter>;
    let accumulator: ItemAccumulatorInstance<number, number>;

    function initInstanceWithFilter(filter?: TestPageIteratorFilter) {
      instance = iterator.instance({
        filter: filter ?? {}
      });
      accumulator = itemAccumulator(instance);
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

      let sub: SubscriptionObject;

      beforeEach(() => {
        sub = new SubscriptionObject();
      })

      afterEach(() => {
        sub.destroy();
      });

      describe('with array value accumulator', () => {
        let arrayIterator: ItemPageIterator<number[], TestPageIteratorFilter>;

        beforeEach(() => {
          arrayIterator = new ItemPageIterator(TEST_PAGE_ARRAY_ITERATOR_DELEGATE);
        });

        let arrayInstance: ItemPageIterationInstance<number[], TestPageIteratorFilter>;
        let arrayAccumulator: ItemAccumulatorInstance<number[], number[]>;

        function initInstanceWithFilter(filter?: TestPageIteratorFilter) {
          arrayInstance = arrayIterator.instance({
            filter: filter ?? {}
          });
          arrayAccumulator = itemAccumulator(arrayInstance);
        }

        beforeEach(() => {
          initInstanceWithFilter();
        });

        afterEach(() => {
          arrayInstance.destroy();
          arrayAccumulator.destroy();
        });

        it('should accumulate the array values to a 2 dimensional array.', (done) => {
          arrayAccumulator.allItems$.pipe(filter((x) => x.length > 0), first()).subscribe((value) => {
            expect(Array.isArray(value)).toBe(true);
            expect(Array.isArray(value[0])).toBe(true);

            done();
          });
        });

        it('should accumulate the multiple array values to a 2 dimensional array.', (done) => {
          const pagesToLoad = 2;

          iteratorNextPageUntilPage(arrayInstance, pagesToLoad).then(() => {

            arrayAccumulator.allItems$.pipe(first()).subscribe((value) => {
              expect(value.length).toBe(pagesToLoad);
              expect(Array.isArray(value)).toBe(true);
              expect(Array.isArray(value[0])).toBe(true);

              done();
            });

          });

        });

        it('should accumulate the multiple array values to a 2 dimensional array and any subsequent values too.', (done) => {
          const pagesToLoad = 2;

          iteratorNextPageUntilPage(arrayInstance, pagesToLoad).then(() => {

            arrayAccumulator.allItems$.pipe(first()).subscribe((value) => {
              expect(value.length).toBe(pagesToLoad);
              expect(Array.isArray(value)).toBe(true);
              expect(Array.isArray(value[0])).toBe(true);
              expect(Array.isArray(value[1])).toBe(true);

              iteratorNextPageUntilPage(arrayInstance, pagesToLoad + 1).then(() => {

                arrayAccumulator.allItems$.pipe(first()).subscribe((value) => {
                  expect(value.length).toBe(pagesToLoad + 1);
                  expect(Array.isArray(value)).toBe(true);
                  expect(Array.isArray(value[value.length - 1])).toBe(true);
                  done();
                });
    
              });
            });

          });

        });

      });

      describe('with error and no successes', () => {

        beforeEach(() => {
          initInstanceWithFilter({
            resultError: new Error('test error')
          });
        });

        it('should return an empty array.', (done) => {
          accumulator.allItems$.pipe(first()).subscribe((items) => {
            expect(items).toBeDefined();
            expect(items.length).toBe(0);
            done();
          });

        });

      });

      describe('with mapping', () => {

        let mappedAccumulator: ItemAccumulatorInstance<string>;

        beforeEach(() => {
          mappedAccumulator = itemAccumulator(instance, (x: number) => `+${x}`);
        })

        afterEach(() => {
          mappedAccumulator.destroy();
        });

        it('should map the items', (done) => {

          sub.subscription = mappedAccumulator.allItems$.pipe(filter(x => x.length > 0)).subscribe((items) => {
            expect(items).toBeDefined();
            expect(typeof items[0]).toBe('string');
            done();
          });

        });

      });

      it('should return all items after being subscribed to a few pages in.', (done) => {

        const pagesToLoad = 5;

        iteratorNextPageUntilPage(instance, pagesToLoad).then(() => {

          sub.subscription = instance.numberOfPagesLoaded$.subscribe((pagesLoaded) => {
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

      it('should emit an empty array before the first state has come through.', (done) => {

        initInstanceWithFilter({
          delayTime: 500
        });

        let emissions = 0;

        // Should trigger first page to be loaded.
        sub.subscription = accumulator.allItems$.subscribe((allItems) => {
          emissions += 1;

          if (emissions === 1) {
            expect(allItems.length).toBe(0);
          } else if (emissions === 2) {
            expect(allItems.length).toBe(1);
            done();
          }
        });

      });

      it('should accumulate values as pages are loaded.', (done) => {

        let emissions = 0;
        let latestAllItems: number[];

        // Should trigger first page to be loaded.
        sub.subscription = accumulator.allItems$.pipe(
          skip(1)   // skip the first empty emission
        ).subscribe((allItems) => {
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
