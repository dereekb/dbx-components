import { inMemoryAsyncKeyedValueCache, inMemoryAsyncValueCache } from './cache.memory';
import { mergeAsyncKeyedValueCaches, mergeAsyncValueCaches } from './cache.merge';

describe('mergeAsyncValueCaches()', () => {
  it('load() should return the first non-null/undefined value', async () => {
    const merged = mergeAsyncValueCaches([inMemoryAsyncValueCache<string>(), inMemoryAsyncValueCache<string>('second')]);
    expect(await merged.load()).toBe('second');
  });

  it('load() should prefer earlier caches', async () => {
    const merged = mergeAsyncValueCaches([inMemoryAsyncValueCache<string>('first'), inMemoryAsyncValueCache<string>('second')]);
    expect(await merged.load()).toBe('first');
  });

  it('load() should return undefined when all caches are empty', async () => {
    const merged = mergeAsyncValueCaches([inMemoryAsyncValueCache<string>(), inMemoryAsyncValueCache<string>()]);
    expect(await merged.load()).toBeUndefined();
  });

  it('update() should write to every cache', async () => {
    const a = inMemoryAsyncValueCache<string>();
    const b = inMemoryAsyncValueCache<string>();
    const merged = mergeAsyncValueCaches([a, b]);

    await merged.update('value');
    expect(await a.load()).toBe('value');
    expect(await b.load()).toBe('value');
  });

  it('clear() should clear every cache', async () => {
    const a = inMemoryAsyncValueCache<string>('a');
    const b = inMemoryAsyncValueCache<string>('b');
    const merged = mergeAsyncValueCaches([a, b]);

    await merged.clear();
    expect(await a.load()).toBeUndefined();
    expect(await b.load()).toBeUndefined();
  });
});

describe('mergeAsyncKeyedValueCaches()', () => {
  it('get() should return the first non-null/undefined entry', async () => {
    const merged = mergeAsyncKeyedValueCaches([inMemoryAsyncKeyedValueCache<number>(), inMemoryAsyncKeyedValueCache<number>({ a: 2 })]);
    expect(await merged.get('a')).toBe(2);
  });

  it('get() should prefer earlier caches', async () => {
    const merged = mergeAsyncKeyedValueCaches([inMemoryAsyncKeyedValueCache<number>({ a: 1 }), inMemoryAsyncKeyedValueCache<number>({ a: 2 })]);
    expect(await merged.get('a')).toBe(1);
  });

  it('load() should merge records with earlier caches taking precedence', async () => {
    const merged = mergeAsyncKeyedValueCaches([inMemoryAsyncKeyedValueCache<number>({ a: 1 }), inMemoryAsyncKeyedValueCache<number>({ a: 99, b: 2 })]);
    expect(await merged.load()).toEqual({ a: 1, b: 2 });
  });

  it('set() should write to every cache', async () => {
    const a = inMemoryAsyncKeyedValueCache<number>();
    const b = inMemoryAsyncKeyedValueCache<number>();
    const merged = mergeAsyncKeyedValueCaches([a, b]);

    await merged.set('k', 7);
    expect(await a.get('k')).toBe(7);
    expect(await b.get('k')).toBe(7);
  });

  it('remove() should remove from every cache', async () => {
    const a = inMemoryAsyncKeyedValueCache<number>({ k: 1 });
    const b = inMemoryAsyncKeyedValueCache<number>({ k: 2 });
    const merged = mergeAsyncKeyedValueCaches([a, b]);

    await merged.remove('k');
    expect(await a.get('k')).toBeUndefined();
    expect(await b.get('k')).toBeUndefined();
  });

  it('clear() should clear every cache', async () => {
    const a = inMemoryAsyncKeyedValueCache<number>({ k: 1 });
    const b = inMemoryAsyncKeyedValueCache<number>({ k: 2 });
    const merged = mergeAsyncKeyedValueCaches([a, b]);

    await merged.clear();
    expect(await a.load()).toEqual({});
    expect(await b.load()).toEqual({});
  });
});
