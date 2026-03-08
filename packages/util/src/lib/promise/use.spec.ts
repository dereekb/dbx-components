import { usePromise } from './use';

describe('usePromise()', () => {
  it('should pass the resolved value to the consumer function', async () => {
    const useFn = usePromise(Promise.resolve(42));
    const result = await useFn(async (value) => value * 2);
    expect(result).toBe(84);
  });

  it('should work with a getter that returns a Promise', async () => {
    const useFn = usePromise(() => Promise.resolve('hello'));
    const result = await useFn(async (value) => value.toUpperCase());
    expect(result).toBe('HELLO');
  });

  it('should be reusable with different consumer functions', async () => {
    const useFn = usePromise(Promise.resolve(10));

    const doubled = await useFn(async (value) => value * 2);
    const stringified = await useFn(async (value) => String(value));

    expect(doubled).toBe(20);
    expect(stringified).toBe('10');
  });
});
