import { first, of, timeout } from 'rxjs';
import { FilterSourceInstance } from './filter.source';
import { Maybe } from '@dereekb/util';

interface TestFilter {
  test?: boolean;
  number?: Maybe<number>;
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

  describe('initialFilter$', () => {
    it('should not return any value if no default observable or initial observable is set.', (done) => {
      filterSource.initialFilter$.pipe(timeout({ first: 200, with: () => of(0) }), first()).subscribe((filter) => {
        expect(filter).toBe(0);
        done();
      });
    });

    it('should return the default observable if no initial observable is set.', (done) => {
      const expectedValue: TestFilter = { test: true, number: 0 };

      filterSource.setDefaultFilter(of(expectedValue));

      filterSource.initialFilter$.pipe(timeout({ first: 200, with: () => of({ test: false } as TestFilter) }), first()).subscribe((filter) => {
        expect(filter?.test).toBe(expectedValue.test);
        expect(filter?.number).toBe(expectedValue.number);
        done();
      });
    });

    it('should return the initial observable if both the default observable and initial observable is set.', (done) => {
      const defaultValue: TestFilter = { test: false, number: 10 };
      const expectedValue: TestFilter = { test: true, number: 0 };

      filterSource.setDefaultFilter(of(defaultValue));
      filterSource.initWithFilter(of(expectedValue));

      filterSource.initialFilter$.pipe(timeout({ first: 200, with: () => of({ test: false } as TestFilter) }), first()).subscribe((filter) => {
        expect(filter?.test).toBe(expectedValue.test);
        expect(filter?.number).toBe(expectedValue.number);
        done();
      });
    });
  });

  /*
  describe('filter$', () => {

  });
  */
});
