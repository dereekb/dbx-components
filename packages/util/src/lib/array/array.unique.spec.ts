import { allowValueOnceFilter, filterUniqueValues, unique } from './array.unique';

describe('unique', () => {
  it('should return only unique values', () => {
    const values = [0, 1, 2, 3, 4];

    const result = unique([...values, ...values]);

    expect(result.length).toBe(values.length);
    values.forEach((x) => expect(result).toContain(x));
  });

  it('should exclude any excluded values', () => {
    const values = [0, 1, 2, 3, 4];

    const result = unique(values, values);

    expect(result.length).toBe(0);
  });
});

describe('filterUniqueValues()', () => {
  it('should return only unique values', () => {
    const values = [0, 1, 2, 3, 4];

    const result = filterUniqueValues([...values, ...values], (x) => x);

    expect(result.length).toBe(values.length);
    values.forEach((x) => expect(result).toContain(x));
  });
});

describe('allowValueOnceFilter()', () => {
  it('should return false for values that return keys that exist in the visited keys set', () => {
    const value = 1;
    const filter = allowValueOnceFilter();

    filter._visitedKeys.add(value);

    expect(filter(value)).toBe(false);
  });

  it('should only return true once for a repeat value', () => {
    const value = 1;

    const filter = allowValueOnceFilter();
    expect(filter(value)).toBe(true);
    expect(filter(value)).toBe(false);
    expect(filter(value)).toBe(false);
    expect(filter(value)).toBe(false);
    expect(filter(value)).toBe(false);

    expect(filter._visitedKeys.size).toBe(1);
  });
});
