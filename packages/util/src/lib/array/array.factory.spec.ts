import { terminatingFactoryFromArray } from './array.factory';

describe('terminatingFactoryFromArray()', () => {
  it('should return the terminating value immediately if the input array is empty.', () => {
    const array: any[] = [];
    const terminatingValue = 'a';
    const result = terminatingFactoryFromArray(array, terminatingValue);
    expect(result()).toBe(terminatingValue);
  });

  it('should return the values in the array in order', () => {
    const array = [1, 2, 3];
    const terminatingValue = 'end';
    const result = terminatingFactoryFromArray<number, 'end'>(array, terminatingValue);

    expect(result()).toBe(array[0]);
    expect(result()).toBe(array[1]);
    expect(result()).toBe(array[2]);
    expect(result()).toBe(terminatingValue);
    expect(result()).toBe(terminatingValue);
  });
});
