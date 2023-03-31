import { sortByNumberFunction } from './sort';

describe('sortByNumberFunction()', () => {
  it('should create a sort comparison function that sorts in ascending order.', () => {
    const sortFn = sortByNumberFunction<number>((x) => x);

    const values = [5, 4, 2, 3, 1];

    const sortedValues = [...values].sort(sortFn);

    expect(sortedValues[0]).toBe(1);
    expect(sortedValues[1]).toBe(2);
    expect(sortedValues[2]).toBe(3);
    expect(sortedValues[3]).toBe(4);
    expect(sortedValues[4]).toBe(5);
  });
});
