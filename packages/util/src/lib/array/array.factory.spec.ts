import { terminatingFactoryFromArray, arrayFactory, arrayInputFactory } from './array.factory';

describe('arrayFactory', () => {
  it('should create an array of the specified count with values from the factory', () => {
    const factory = jest.fn().mockReturnValue('test-item');
    const arrayFactoryFn = arrayFactory(factory);

    const result = arrayFactoryFn(3);

    expect(result).toHaveLength(3);
    expect(result).toEqual(['test-item', 'test-item', 'test-item']);
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('should call factory with index for FactoryWithIndex', () => {
    const factory = jest.fn((index) => `item-${index}`);
    const arrayFactoryFn = arrayFactory(factory);

    const result = arrayFactoryFn(3);

    expect(result).toEqual(['item-0', 'item-1', 'item-2']);
    expect(factory).toHaveBeenCalledWith(0);
    expect(factory).toHaveBeenCalledWith(1);
    expect(factory).toHaveBeenCalledWith(2);
  });

  it('should handle count of 0', () => {
    const factory = jest.fn();
    const arrayFactoryFn = arrayFactory(factory);

    const result = arrayFactoryFn(0);

    expect(result).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('arrayInputFactory', () => {
  it('should transform each input value using the provided factory', () => {
    const factory = jest.fn((x: number) => x * 2);
    const inputFactoryFn = arrayInputFactory(factory);

    const result = inputFactoryFn([1, 2, 3]);

    expect(result).toEqual([2, 4, 6]);
    expect(factory).toHaveBeenCalledTimes(3);
    expect(factory).toHaveBeenNthCalledWith(1, 1);
    expect(factory).toHaveBeenNthCalledWith(2, 2);
    expect(factory).toHaveBeenNthCalledWith(3, 3);
  });

  it('should handle empty input array', () => {
    const factory = jest.fn();
    const inputFactoryFn = arrayInputFactory(factory);

    const result = inputFactoryFn([]);

    expect(result).toEqual([]);
    expect(factory).not.toHaveBeenCalled();
  });

  it('should work with complex transformations', () => {
    interface Input {
      value: number;
    }
    interface Output {
      doubled: number;
      original: number;
    }

    const factory = (input: Input): Output => ({
      doubled: input.value * 2,
      original: input.value
    });

    const inputFactoryFn = arrayInputFactory<Output, Input>(factory);

    const result = inputFactoryFn([{ value: 1 }, { value: 2 }]);

    expect(result).toEqual([
      { doubled: 2, original: 1 },
      { doubled: 4, original: 2 }
    ]);
  });
});

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

  it('should use null as default terminating value when not specified', () => {
    const array = ['a', 'b'];
    const result = terminatingFactoryFromArray(array);

    expect(result()).toBe('a');
    expect(result()).toBe('b');
    expect(result()).toBe(null);
  });

  it('should maintain internal state across multiple calls', () => {
    const array = ['first', 'second'];
    const factory = terminatingFactoryFromArray(array, 'done');

    // First call sequence
    expect(factory()).toBe('first');
    expect(factory()).toBe('second');
    expect(factory()).toBe('done');

    // Calling again continues to return the terminating value
    expect(factory()).toBe('done');
    expect(factory()).toBe('done');
  });
});
