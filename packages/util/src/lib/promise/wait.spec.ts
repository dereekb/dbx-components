import { waitForMs } from './wait';

describe('waitForMs()', () => {
  it('should resolve after the specified delay', async () => {
    const start = Date.now();
    await waitForMs(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timing variance
  });

  it('should resolve with undefined when no value is provided', async () => {
    const result = await waitForMs(10);
    expect(result).toBeUndefined();
  });

  it('should resolve with the provided value', async () => {
    const result = await waitForMs(10, 'hello');
    expect(result).toBe('hello');
  });

  it('should resolve immediately when ms is 0', async () => {
    const start = Date.now();
    await waitForMs(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
