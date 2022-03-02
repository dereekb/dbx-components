import { performTaskLoop } from './promise.loop';

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
