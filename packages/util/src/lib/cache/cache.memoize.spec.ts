import { type AsyncKeyedValueCache, type AsyncValueCache } from './cache';
import { inMemoryAsyncKeyedValueCache, inMemoryAsyncValueCache } from './cache.memory';
import { memoizeAsyncKeyedValueCache, memoizeAsyncValueCache } from './cache.memoize';

interface CallCounter {
  loadCount: number;
  updateCount: number;
  clearCount: number;
  getCount: number;
  setCount: number;
  removeCount: number;
}

function instrumentValueCache<T>(inner: AsyncValueCache<T>): { cache: AsyncValueCache<T>; counter: CallCounter } {
  const counter: CallCounter = { loadCount: 0, updateCount: 0, clearCount: 0, getCount: 0, setCount: 0, removeCount: 0 };
  const cache: AsyncValueCache<T> = {
    load: async () => {
      counter.loadCount += 1;
      return inner.load();
    },
    update: async (value) => {
      counter.updateCount += 1;
      return inner.update(value);
    },
    clear: async () => {
      counter.clearCount += 1;
      return inner.clear();
    }
  };
  return { cache, counter };
}

function instrumentKeyedCache<T>(inner: AsyncKeyedValueCache<T>): { cache: AsyncKeyedValueCache<T>; counter: CallCounter } {
  const counter: CallCounter = { loadCount: 0, updateCount: 0, clearCount: 0, getCount: 0, setCount: 0, removeCount: 0 };
  const cache: AsyncKeyedValueCache<T> = {
    load: async () => {
      counter.loadCount += 1;
      return inner.load();
    },
    get: async (key) => {
      counter.getCount += 1;
      return inner.get(key);
    },
    set: async (key, value) => {
      counter.setCount += 1;
      return inner.set(key, value);
    },
    remove: async (key) => {
      counter.removeCount += 1;
      return inner.remove(key);
    },
    clear: async () => {
      counter.clearCount += 1;
      return inner.clear();
    }
  };
  return { cache, counter };
}

describe('memoizeAsyncValueCache()', () => {
  it('should hit the inner cache only once across multiple loads', async () => {
    const { cache: instrumented, counter } = instrumentValueCache(inMemoryAsyncValueCache<string>('initial'));
    const memoized = memoizeAsyncValueCache(instrumented);

    expect(await memoized.load()).toBe('initial');
    expect(await memoized.load()).toBe('initial');
    expect(await memoized.load()).toBe('initial');
    expect(counter.loadCount).toBe(1);
  });

  it('update() should write through and refresh the memo', async () => {
    const { cache: instrumented, counter } = instrumentValueCache(inMemoryAsyncValueCache<string>());
    const memoized = memoizeAsyncValueCache(instrumented);

    await memoized.update('next');
    expect(await memoized.load()).toBe('next');
    expect(counter.updateCount).toBe(1);
    expect(counter.loadCount).toBe(0);
  });

  it('clear() should clear both layers', async () => {
    const { cache: instrumented, counter } = instrumentValueCache(inMemoryAsyncValueCache<string>('initial'));
    const memoized = memoizeAsyncValueCache(instrumented);

    expect(await memoized.load()).toBe('initial');
    await memoized.clear();
    expect(await memoized.load()).toBeUndefined();
    expect(counter.clearCount).toBe(1);
  });
});

describe('memoizeAsyncKeyedValueCache()', () => {
  it('should hit the inner cache only once across multiple reads', async () => {
    const { cache: instrumented, counter } = instrumentKeyedCache(inMemoryAsyncKeyedValueCache<number>({ a: 1, b: 2 }));
    const memoized = memoizeAsyncKeyedValueCache(instrumented);

    expect(await memoized.get('a')).toBe(1);
    expect(await memoized.get('b')).toBe(2);
    expect(await memoized.load()).toEqual({ a: 1, b: 2 });
    expect(counter.loadCount).toBe(1);
    expect(counter.getCount).toBe(0);
  });

  it('set() should write through and update the memo', async () => {
    const { cache: instrumented } = instrumentKeyedCache(inMemoryAsyncKeyedValueCache<number>());
    const memoized = memoizeAsyncKeyedValueCache(instrumented);

    await memoized.set('a', 1);
    await memoized.set('b', 2);
    expect(await memoized.get('a')).toBe(1);
    expect(await memoized.get('b')).toBe(2);
  });

  it('remove() should drop only the requested key', async () => {
    const { cache: instrumented } = instrumentKeyedCache(inMemoryAsyncKeyedValueCache<number>({ a: 1, b: 2 }));
    const memoized = memoizeAsyncKeyedValueCache(instrumented);

    await memoized.remove('a');
    expect(await memoized.get('a')).toBeUndefined();
    expect(await memoized.get('b')).toBe(2);
  });

  it('clear() should clear both layers', async () => {
    const inner = inMemoryAsyncKeyedValueCache<number>({ a: 1 });
    const memoized = memoizeAsyncKeyedValueCache(inner);

    await memoized.load();
    await memoized.clear();
    expect(await memoized.load()).toEqual({});
    expect(await inner.load()).toEqual({});
  });

  it('load() should return a snapshot independent from the memoized record', async () => {
    const memoized = memoizeAsyncKeyedValueCache(inMemoryAsyncKeyedValueCache<number>({ a: 1 }));
    const snapshot = await memoized.load();
    snapshot.a = 999;
    expect(await memoized.get('a')).toBe(1);
  });
});
