import { performMakeLoop, performTaskCountLoop, performTaskLoop } from './promise.loop';

describe('performTaskLoop()', () => {

  it('should loop until checkContinue() returns false.', async () => {

    const maxIterations = 5;

    const result = await performTaskLoop<number>({
      initValue: -1,
      checkContinue: (value: number, i) => value < maxIterations,
      next: async (i) => i
    });

    expect(result).toBe(maxIterations);

  });

  it('should return the inital value if the check fails on the first call.', async () => {

    const initValue = 5;

    const result = await performTaskLoop<number>({
      initValue,
      checkContinue: (value, i) => false,
      next: async (i) => i + 10000  // never called
    });

    expect(result).toBe(initValue);
  });

  it('should loop until an error occurs in next.', async () => {

    const maxIterations = 5;

    try {
      await performTaskLoop<number>({
        checkContinue: (value, i) => i < maxIterations,
        next: async (i) => {
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
        checkContinue: (value, i) => {
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
      next: async (x) => i += 1
    });

    expect(i).toBe(count);
  });

});

describe('performMakeLoop()', () => {

  it('should create n number of items, where n = count', async () => {
    const count = 3;
    const results = await performMakeLoop({
      count,
      make: async (i: number) => 1
    });

    expect(results.length).toBe(3);
    expect(results[0]).toBe(1);
  });

});
