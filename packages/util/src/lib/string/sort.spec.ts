import { sortByStringFunction } from './sort';

describe('sortByStringFunction()', () => {
  it('should create a sort comparison function that sorts in ascending order.', () => {
    const sortFn = sortByStringFunction<string>((x) => x);

    const values = ['a', 'b', 'e', 'd', 'c'];

    const sortedValues = [...values].sort(sortFn);

    expect(sortedValues[0]).toBe('a');
    expect(sortedValues[1]).toBe('b');
    expect(sortedValues[2]).toBe('c');
    expect(sortedValues[3]).toBe('d');
    expect(sortedValues[4]).toBe('e');
  });
});
