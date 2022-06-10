import { range } from '../array';
import { performBatchLoop, performMakeLoop, performTaskCountLoop, performTaskLoop } from './promise.loop';

describe('performTaskLoop()', () => {
  it('should loop until checkContinue() returns false.', async () => {
    const maxIterations = 5;

    const result = await performTaskLoop<number>({
      initValue: -1,
      checkContinue: (value: number) => value < maxIterations,
      next: async (i) => i
    });

    expect(result).toBe(maxIterations);
  });

  it('should return the inital value if the check fails on the first call.', async () => {
    const initValue = 5;

    const result = await performTaskLoop<number>({
      initValue,
      checkContinue: () => false,
      next: async (i) => i + 10000 // never called
    });

    expect(result).toBe(initValue);
  });

  it('should loop until an error occurs in next.', async () => {
    const maxIterations = 5;

    try {
      await performTaskLoop<number>({
        checkContinue: (_, i) => i < maxIterations,
        next: async () => {
          throw new Error();
        }
      });
      fail();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it('should loop until an error occurs in checkContinue.', async () => {
    try {
      await performTaskLoop<number>({
        checkContinue: () => {
          throw new Error();
        },
        next: async (i) => i
      });
      fail();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe('performTaskCountLoop()', () => {
  it('should loop the expected number of times.', async () => {
    let i = 0;
    const count = 3;

    await performTaskCountLoop({
      count,
      next: async () => (i += 1)
    });

    expect(i).toBe(count);
  });
});

describe('performMakeLoop()', () => {
  it('should create n number of items, where n = count', async () => {
    const count = 3;
    const results = await performMakeLoop({
      count,
      make: async () => 1
    });

    expect(results.length).toBe(3);
    expect(results[0]).toBe(1);
  });
});

describe('performBatchLoop()', () => {
  it('should create batches of items', async () => {
    const totalItems = 15;
    const itemsPerBatch = 5;

    const results = await performBatchLoop({
      totalItems,
      itemsPerBatch,
      make: async (itemsToMake) => range(itemsToMake)
    });

    const allItems = results.flat();
    expect(allItems.length).toBe(totalItems);
    expect(results.length).toBe(totalItems / itemsPerBatch);
  });

  it('should create the expected number items with a remainder', async () => {
    const totalItems = 15;
    const itemsPerBatch = 4;

    const results = await performBatchLoop({
      totalItems,
      itemsPerBatch,
      make: async (itemsToMake) => range(itemsToMake)
    });

    const allItems = results.flat();
    expect(allItems.length).toBe(totalItems);
    expect(results.length).toBe(Math.ceil(totalItems / itemsPerBatch));
  });
});
