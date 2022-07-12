import { invertFilter, mergeFilterFunctions } from './filter';

describe('mergeFilterFunctions()', () => {
  it('should return a default passing filter if there is no input.', () => {
    const filter = mergeFilterFunctions();
    expect(filter).toBeDefined();

    const result = filter(0, 0);
    expect(result).toBe(true);
  });

  it('should return the only input filter.', () => {
    const filter = () => false;

    const result = mergeFilterFunctions(filter);

    expect(result).toBe(filter);
  });

  describe('function', () => {
    const accept = () => true;
    const reject = () => false;

    it('should return true if all filters return true.', () => {
      const acceptFilter = mergeFilterFunctions(accept, accept);
      expect(acceptFilter).not.toBe(accept);

      const result = acceptFilter(0, 0);
      expect(result).toBe(true);
    });

    it('should return false if any filter returns false.', () => {
      const rejectFilter = mergeFilterFunctions(accept, reject);
      expect(rejectFilter).not.toBe(reject);

      const result = rejectFilter(0, 0);
      expect(result).toBe(false);
    });
  });
});

describe('invertFilter()', () => {
  it('should return a function that returns the opposite value given the input.', () => {
    const value = true;
    const baseFilter = () => value;
    const invertedFilter = invertFilter(baseFilter);

    const result = invertedFilter();
    expect(result).toBe(!value);
  });
});
