import { useCallback } from './callback';

describe('useCallback()', () => {
  it('should resolve when the callback is invoked without an error', async () => {
    await expect(
      useCallback((cb) => {
        cb();
      })
    ).resolves.toBeUndefined();
  });

  it('should reject when the callback is invoked with an error', async () => {
    const error = new Error('test error');

    await expect(
      useCallback((cb) => {
        cb(error);
      })
    ).rejects.toBe(error);
  });

  it('should work with async operations that invoke the callback later', async () => {
    const result = useCallback((cb) => {
      setTimeout(() => cb(), 10);
    });

    await expect(result).resolves.toBeUndefined();
  });
});
