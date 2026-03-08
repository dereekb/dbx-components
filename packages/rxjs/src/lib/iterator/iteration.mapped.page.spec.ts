import { ItemPageIterator, type ItemPageIterationInstance } from './iterator.page';
import { type TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { mappedPageItemIteration, type MappedPageItemIterationInstance } from './iteration.mapped.page';
import { first } from 'rxjs';
import { callbackTest } from '@dereekb/util/test';

describe('iteration.mapped.page', () => {
  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;
  let instance: ItemPageIterationInstance<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('MappedPageItemIterationInstance', () => {
    let mappedInstance: MappedPageItemIterationInstance<string, number>;

    beforeEach(() => {
      mappedInstance = mappedPageItemIteration(instance, {
        mapValue: (x) => `+${x}`
      });
    });

    describe('latestState$', () => {
      it(
        'should map the loading state value through the mapping function',
        callbackTest((done) => {
          instance.next();

          mappedInstance.latestState$.pipe(first()).subscribe((state) => {
            expect(state.value).toBe('+0');
            done();
          });
        })
      );
    });

    describe('nextPage()', () => {
      it(
        'should load the next page and return the page number',
        callbackTest((done) => {
          instance.next(); // load first page

          instance.latestState$.pipe(first()).subscribe(() => {
            // first page loaded, now load the next
            mappedInstance.nextPage().then((page) => {
              expect(page).toBe(1);
              done();
            });
          });
        })
      );
    });

    describe('getMaxPageLoadLimit()', () => {
      it('should return the max page load limit from the underlying iteration', () => {
        instance.setMaxPageLoadLimit(5);
        expect(mappedInstance.getMaxPageLoadLimit()).toBe(5);
      });
    });

    describe('setMaxPageLoadLimit()', () => {
      it('should forward the max page load limit to the underlying iteration', () => {
        mappedInstance.setMaxPageLoadLimit(10);
        expect(instance.getMaxPageLoadLimit()).toBe(10);
      });
    });
  });
});
