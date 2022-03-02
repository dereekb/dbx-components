import { keepValuesFromArray } from './array.set';

describe('keepValuesFromArray', () => {

  it('should keep values from the array.', () => {
    const array = ['a', 'b', 'c'];
    const keep = ['a'];

    const result = keepValuesFromArray(array, keep);

    expect(result.length).toBe(1);
    expect(result).toContain(keep[0]);
    expect(result).not.toContain(array[1]);
    expect(result).not.toContain(array[2]);
  });

});
