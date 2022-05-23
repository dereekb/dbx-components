import { filter, first, of, timeout } from 'rxjs';
import { FilterMap } from './filter.map';

interface TestFilter {
  test?: boolean;
}

describe('FilterMap', () => {

  const testKey = 'a';

  let filterMap: FilterMap<TestFilter>;

  beforeEach(() => {
    filterMap = new FilterMap();
  });

  afterEach(() => {
    filterMap.destroy();
  });

  describe('filterForKey()', () => {

    it('should not return an filter if a filter has not been set for that key', (done) => {
      filterMap.filterForKey(testKey).pipe(timeout({ first: 200, with: () => of(0) }), first()).subscribe((filter) => {
        expect(filter).toBe(0);
        done();
      });
    });

    it('should return a filter if a filter is set for a key.', (done) => {
      const testFilter = {};

      filterMap.addFilterObs(testKey, of(testFilter));

      filterMap.filterForKey(testKey).pipe(first()).subscribe((filter) => {
        expect(filter).toBe(testFilter);
        done();
      });
    });

    it('should return a filter if a default filter obs is set for a key.', (done) => {
      const testFilter = {};

      filterMap.addDefaultFilterObs(testKey, of(testFilter));
      filterMap.filterForKey(testKey).pipe(first()).subscribe((filter) => {
        expect(filter).toBe(testFilter);
        done();
      });
    });

    it('should not return a filter if a default filter obs that has no value is set for a key.', (done) => {
      filterMap.addDefaultFilterObs(testKey, of({}));
      filterMap.filterForKey(testKey).pipe(timeout({ first: 200, with: () => of(0) }), first()).subscribe((filter) => {
        expect(filter).toBe(0);
        done();
      });
    });

  });

  describe('addFilterObs()', () => {

    it('should replace the existing filter observable for that key', (done) => {
      const testFilterA = {};
      const testFilterB = {};

      filterMap.addFilterObs(testKey, of(testFilterA));
      filterMap.filterForKey(testKey).pipe(filter(x => x === testFilterB), first()).subscribe((filter) => {
        expect(filter).toBe(testFilterB);
        done();
      });

      // replace filter
      filterMap.addFilterObs(testKey, of(testFilterB));
    });

    it('values from this observable should be returned instead of those from the default filter for that key.', (done) => {
      const testFilterA = {};
      const testFilterB = {};

      filterMap.addDefaultFilterObs(testKey, of(testFilterB));
      filterMap.addFilterObs(testKey, of(testFilterA));

      filterMap.filterForKey(testKey).pipe(first()).subscribe((filter) => {
        expect(filter).toBe(testFilterA);
        done();
      });

    });

  });

});
