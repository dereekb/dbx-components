import { ItemPageIterator, type ItemPageIterationInstance } from './iterator.page';
import { type TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { mapItemIteration, type MappedItemIterationInstance } from '@dereekb/rxjs';
import { first } from 'rxjs';

describe('iteration.mapped', () => {
  let iterator: ItemPageIterator<number, TestPageIteratorFilter>;
  let instance: ItemPageIterationInstance<number, TestPageIteratorFilter>;

  beforeEach(() => {
    iterator = new ItemPageIterator(TEST_PAGE_ITERATOR_DELEGATE);
    instance = iterator.instance({});
  });

  afterEach(() => {
    instance.destroy();
  });

  describe('MappedItemIterationInstance', () => {
    let mappedInstance: MappedItemIterationInstance<string, number>;

    beforeEach(() => {
      mappedInstance = mapItemIteration(instance, {
        mapValue: (x) => `+${x}`
      });
    });

    describe('latestState$', () => {
      it('should returned the latest state with the mapped value', (done) => {
        mappedInstance.latestState$.pipe(first()).subscribe((x) => {
          expect(typeof x.value).toBe('string');
          done();
        });
      });
    });
  });
});
