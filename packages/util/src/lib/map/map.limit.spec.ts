import { describe, expect, it, vi } from 'vitest';
import { assertLimitedCollectionLimit, LimitedMap, limitMap } from './map.limit';

describe('limitMap()', () => {
  it('should delete the oldest entries until the size is at the limit', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
    const result = limitMap(map, { limit: 2 });

    expect(result).toBe(map);
    expect([...map.keys()]).toEqual(['b', 'c']);
  });

  it('should leave a map at or under the limit untouched', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    const onEvict = vi.fn();
    limitMap(map, { limit: 2, onEvict });

    expect([...map.keys()]).toEqual(['a', 'b']);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('should pass each evicted entry to onEvict, oldest first', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4]
    ]);
    const onEvict = vi.fn();
    limitMap(map, { limit: 1, onEvict });

    expect(onEvict.mock.calls).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
    expect([...map.keys()]).toEqual(['d']);
  });

  it('should empty the map at a limit of 0', () => {
    const map = new Map([['a', 1]]);
    limitMap(map, { limit: 0 });
    expect(map.size).toBe(0);
  });
});

describe('assertLimitedCollectionLimit()', () => {
  it('should return a positive integer', () => {
    expect(assertLimitedCollectionLimit(3)).toBe(3);
  });

  it('should throw for zero, negative, fractional and non-finite limits', () => {
    expect(() => assertLimitedCollectionLimit(0)).toThrow(RangeError);
    expect(() => assertLimitedCollectionLimit(-1)).toThrow(RangeError);
    expect(() => assertLimitedCollectionLimit(1.5)).toThrow(RangeError);
    expect(() => assertLimitedCollectionLimit(Number.NaN)).toThrow(RangeError);
    expect(() => assertLimitedCollectionLimit(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('LimitedMap', () => {
  it('should be a Map', () => {
    const map = new LimitedMap<string, number>({ limit: 2 });
    expect(map).toBeInstanceOf(Map);
    expect(map).toBeInstanceOf(LimitedMap);
  });

  it('should expose its limit and order, defaulting the order to recent', () => {
    const map = new LimitedMap<string, number>({ limit: 2 });
    expect(map.limit).toBe(2);
    expect(map.order).toBe('recent');
    expect(new LimitedMap<string, number>({ limit: 2, order: 'insertion' }).order).toBe('insertion');
  });

  it('should throw when the limit is not a positive integer', () => {
    expect(() => new LimitedMap<string, number>({ limit: 0 })).toThrow(RangeError);
  });

  it('should never hold more than its limit', () => {
    const map = new LimitedMap<number, number>({ limit: 3 });

    for (let i = 0; i < 10; i += 1) {
      map.set(i, i);
      expect(map.size).toBeLessThanOrEqual(3);
    }

    expect([...map.keys()]).toEqual([7, 8, 9]);
  });

  it('should return itself from set, so calls chain', () => {
    const map = new LimitedMap<string, number>({ limit: 2 });
    expect(map.set('a', 1).set('b', 2)).toBe(map);
  });

  describe('initial entries', () => {
    it('should insert them in order', () => {
      const map = new LimitedMap<string, number>({ limit: 3 }, [
        ['a', 1],
        ['b', 2]
      ]);
      expect([...map.entries()]).toEqual([
        ['a', 1],
        ['b', 2]
      ]);
    });

    it('should trim initial entries over the limit, evicting through onEvict', () => {
      const onEvict = vi.fn();
      const map = new LimitedMap<string, number>({ limit: 2, onEvict }, [
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);

      expect([...map.keys()]).toEqual(['b', 'c']);
      expect(onEvict.mock.calls).toEqual([['a', 1]]);
    });
  });

  describe("order: 'recent'", () => {
    it('should refresh a key on get', () => {
      const map = new LimitedMap<string, number>({ limit: 2 });
      map.set('a', 1).set('b', 2);

      expect(map.get('a')).toBe(1);
      map.set('c', 3);

      expect([...map.keys()]).toEqual(['a', 'c']);
    });

    it('should not refresh a key on has', () => {
      const map = new LimitedMap<string, number>({ limit: 2 });
      map.set('a', 1).set('b', 2);

      expect(map.has('a')).toBe(true);
      map.set('c', 3);

      expect([...map.keys()]).toEqual(['b', 'c']);
    });

    it('should refresh a key that is set again', () => {
      const map = new LimitedMap<string, number>({ limit: 2 });
      map.set('a', 1).set('b', 2).set('a', 10).set('c', 3);

      expect([...map.entries()]).toEqual([
        ['a', 10],
        ['c', 3]
      ]);
    });

    it('should return undefined and add nothing on a get of an absent key', () => {
      const map = new LimitedMap<string, number>({ limit: 2 });
      map.set('a', 1);

      expect(map.get('z')).toBeUndefined();
      expect([...map.keys()]).toEqual(['a']);
    });

    it('should refresh a key whose stored value is undefined', () => {
      const map = new LimitedMap<string, number | undefined>({ limit: 2 });
      map.set('a', undefined).set('b', 2);

      expect(map.get('a')).toBeUndefined();
      map.set('c', 3);

      expect([...map.keys()]).toEqual(['a', 'c']);
    });
  });

  describe("order: 'insertion'", () => {
    it('should not refresh a key on get', () => {
      const map = new LimitedMap<string, number>({ limit: 2, order: 'insertion' });
      map.set('a', 1).set('b', 2);

      expect(map.get('a')).toBe(1);
      map.set('c', 3);

      expect([...map.keys()]).toEqual(['b', 'c']);
    });

    it('should update a key that is set again in place, without refreshing it', () => {
      const map = new LimitedMap<string, number>({ limit: 2, order: 'insertion' });
      map.set('a', 1).set('b', 2).set('a', 10);

      expect([...map.entries()]).toEqual([
        ['a', 10],
        ['b', 2]
      ]);

      map.set('c', 3);
      expect([...map.keys()]).toEqual(['b', 'c']);
    });
  });

  it('should pass each evicted entry to onEvict, oldest first', () => {
    const onEvict = vi.fn();
    const map = new LimitedMap<string, number>({ limit: 1, onEvict });
    map.set('a', 1).set('b', 2).set('c', 3);

    expect(onEvict.mock.calls).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
  });

  it('should not call onEvict on delete or clear', () => {
    const onEvict = vi.fn();
    const map = new LimitedMap<string, number>({ limit: 3, onEvict });
    map.set('a', 1).set('b', 2).set('c', 3);

    expect(map.delete('a')).toBe(true);
    expect([...map.keys()]).toEqual(['b', 'c']);

    map.clear();
    expect(map.size).toBe(0);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('should take the room a delete frees without evicting', () => {
    const map = new LimitedMap<string, number>({ limit: 2 });
    map.set('a', 1).set('b', 2);
    map.delete('a');
    map.set('c', 3);

    expect([...map.keys()]).toEqual(['b', 'c']);
  });

  it('should keep the cap after a clear', () => {
    const map = new LimitedMap<string, number>({ limit: 1 });
    map.set('a', 1);
    map.clear();
    map.set('b', 2).set('c', 3);

    expect([...map.keys()]).toEqual(['c']);
  });
});
