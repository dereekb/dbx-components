import { ItemPageIterator, ItemPageIterationInstance } from './iterator.page';
import { TestPageIteratorFilter, TEST_PAGE_ITERATOR_DELEGATE } from './iterator.page.spec';
import { first } from 'rxjs/operators';
import { mapItemIteration, MappedItemIterationInstance } from '@dereekb/rxjs';

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
          expect(typeof x.model).toBe('string');
          done();
        });
      });

    });

  });

});
