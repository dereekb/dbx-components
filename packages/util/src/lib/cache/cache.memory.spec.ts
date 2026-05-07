import { inMemoryAsyncKeyedValueCache, inMemoryAsyncValueCache } from './cache.memory';

describe('inMemoryAsyncValueCache()', () => {
  it('should return undefined when no value is set', async () => {
    const cache = inMemoryAsyncValueCache<number>();
    expect(await cache.load()).toBeUndefined();
  });

  it('should accept an initial value', async () => {
    const cache = inMemoryAsyncValueCache<number>(7);
    expect(await cache.load()).toBe(7);
  });

  it('should roundtrip update and load', async () => {
    const cache = inMemoryAsyncValueCache<string>();
    await cache.update('hello');
    expect(await cache.load()).toBe('hello');
  });

  it('clear() should reset stored value to undefined', async () => {
    const cache = inMemoryAsyncValueCache<string>('start');
    await cache.clear();
    expect(await cache.load()).toBeUndefined();
  });
});

describe('inMemoryAsyncKeyedValueCache()', () => {
  it('should return undefined for unknown keys', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>();
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('should accept initial entries', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>({ a: 1 });
    expect(await cache.get('a')).toBe(1);
    expect(await cache.load()).toEqual({ a: 1 });
  });

  it('should roundtrip set and get', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>();
    await cache.set('a', 1);
    await cache.set('b', 2);
    expect(await cache.get('a')).toBe(1);
    expect(await cache.get('b')).toBe(2);
  });

  it('remove() should drop only the requested key', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>({ a: 1, b: 2 });
    await cache.remove('a');
    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('b')).toBe(2);
  });

  it('clear() should drop all keys', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>({ a: 1, b: 2 });
    await cache.clear();
    expect(await cache.load()).toEqual({});
  });

  it('load() should return a copy that callers cannot mutate', async () => {
    const cache = inMemoryAsyncKeyedValueCache<number>({ a: 1 });
    const snapshot = await cache.load();
    snapshot.a = 999;
    expect(await cache.get('a')).toBe(1);
  });
});
