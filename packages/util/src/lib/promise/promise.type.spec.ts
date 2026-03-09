import { asPromise } from './promise.type';

describe('asPromise()', () => {
  it('should wrap a synchronous value in a resolved Promise', async () => {
    const result = await asPromise(42);
    expect(result).toBe(42);
  });

  it('should return the same Promise if the input is already a Promise', async () => {
    const promise = Promise.resolve('hello');
    const result = asPromise(promise);
    expect(result).toBe(promise);
    expect(await result).toBe('hello');
  });

  it('should handle null and undefined values', async () => {
    expect(await asPromise(null)).toBeNull();
    expect(await asPromise(undefined)).toBeUndefined();
  });
});
