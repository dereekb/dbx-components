import { iterate } from './iterate';

describe('iterate()', () => {
  it('should iterate over each value in order', async () => {
    const results: number[] = [];
    await iterate([1, 2, 3], (value) => {
      results.push(value);
    });

    expect(results).toEqual([1, 2, 3]);
  });

  it('should await async callbacks sequentially', async () => {
    const results: number[] = [];
    await iterate([1, 2, 3], async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      results.push(value);
    });

    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle an empty array', async () => {
    const results: number[] = [];
    await iterate([], (value) => {
      results.push(value);
    });

    expect(results).toEqual([]);
  });

  it('should run the example successfully', async () => {
    const processed: number[] = [];
    await iterate([1, 2, 3], async (value) => {
      processed.push(value);
    });

    expect(processed).toEqual([1, 2, 3]);
  });
});
