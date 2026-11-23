import { compareStrings, compareStringsByCodeUnit, compareStringsNumeric, sortByStringFunction } from './sort';

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

describe('compareStrings', () => {
  it('should sort strings in ascending alphabetical order.', () => {
    const sortedValues = ['b', 'a', 'e', 'd', 'c'].sort(compareStrings);
    expect(sortedValues).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('compareStringsNumeric', () => {
  it('should sort numeric strings by numeric value rather than lexicographically.', () => {
    const sortedValues = ['10', '2', '1', '20', '3'].sort(compareStringsNumeric);
    expect(sortedValues).toEqual(['1', '2', '3', '10', '20']);
  });
});

describe('compareStringsByCodeUnit', () => {
  it('should sort strings by UTF-16 code unit.', () => {
    const sortedValues = ['b', 'B', 'a', 'A', '_', '-', 'é', 'e'].sort(compareStringsByCodeUnit);
    expect(sortedValues).toEqual(['-', 'A', 'B', '_', 'a', 'b', 'e', 'é']);
  });

  it('should return 0 for equal strings.', () => {
    expect(compareStringsByCodeUnit('abc', 'abc')).toBe(0);
  });

  it('should order uppercase before lowercase, unlike compareStrings.', () => {
    const values = ['b', 'B', 'a'];
    expect([...values].sort(compareStringsByCodeUnit)).toEqual(['B', 'a', 'b']);
    expect([...values].sort(compareStrings)).not.toEqual(['B', 'a', 'b']);
  });
});
