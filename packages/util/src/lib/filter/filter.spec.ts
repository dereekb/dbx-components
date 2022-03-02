import { invertFilter } from './filter';

describe('invertFilter()', () => {

  it('should return a function that returns the opposite value given the input.', () => {
    const value = true;
    const baseFilter = () => value;
    const invertedFilter = invertFilter(baseFilter);

    const result = invertedFilter();
    expect(result).toBe(!value);
  });

});
