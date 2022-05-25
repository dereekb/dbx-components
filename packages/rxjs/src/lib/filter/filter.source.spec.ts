import { first, of, timeout } from 'rxjs';
import { FilterSourceInstance } from './filter.source';

interface TestFilter {
  test?: boolean;
}

describe('FilterSourceInstance', () => {

  let filterSource: FilterSourceInstance<TestFilter>;

  beforeEach(() => {
    filterSource = new FilterSourceInstance();
  });

  afterEach(() => {
    filterSource.destroy();
  });

  describe('defaultFilter$', () => {

    it('should not return any value if no default observable is set.', (done) => {
      filterSource.defaultFilter$.pipe(timeout({ first: 200, with: () => of(0) }), first()).subscribe((filter) => {
        expect(filter).toBe(0);
        done();
      });
    });

  });

  /*
  describe('initialFilter$', () => {

  });

  describe('filter$', () => {

  });
  */

});
