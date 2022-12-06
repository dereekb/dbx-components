import { range } from './array.number';

describe('range()', () => {
  it('should create a range with negative values.', () => {
    const result = range({ end: -5 });
    expect(result.length).toBe(5);

    expect(result[0]).toBe(0);
    expect(result[1]).toBe(-1);
    expect(result[2]).toBe(-2);
    expect(result[3]).toBe(-3);
    expect(result[4]).toBe(-4);
  });
});
