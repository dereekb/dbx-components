import { describe, expect, it, vi } from 'vitest';
import { LimitedSet, limitSet } from './set.limit';

describe('limitSet()', () => {
  it('should delete the oldest values until the size is at the limit', () => {
    const set = new Set(['a', 'b', 'c']);
    const result = limitSet(set, { limit: 2 });

    expect(result).toBe(set);
    expect([...set]).toEqual(['b', 'c']);
  });

  it('should leave a set at or under the limit untouched', () => {
    const set = new Set(['a', 'b']);
    const onEvict = vi.fn();
    limitSet(set, { limit: 2, onEvict });

    expect([...set]).toEqual(['a', 'b']);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('should pass each evicted value to onEvict, oldest first', () => {
    const set = new Set(['a', 'b', 'c', 'd']);
    const onEvict = vi.fn();
    limitSet(set, { limit: 1, onEvict });

    expect(onEvict.mock.calls).toEqual([['a'], ['b'], ['c']]);
    expect([...set]).toEqual(['d']);
  });

  it('should empty the set at a limit of 0', () => {
    const set = new Set(['a']);
    limitSet(set, { limit: 0 });
    expect(set.size).toBe(0);
  });
});

describe('LimitedSet', () => {
  it('should be a Set', () => {
    const set = new LimitedSet<string>({ limit: 2 });
    expect(set).toBeInstanceOf(Set);
    expect(set).toBeInstanceOf(LimitedSet);
  });

  it('should expose its limit and order, defaulting the order to recent', () => {
    const set = new LimitedSet<string>({ limit: 2 });
    expect(set.limit).toBe(2);
    expect(set.order).toBe('recent');
    expect(new LimitedSet<string>({ limit: 2, order: 'insertion' }).order).toBe('insertion');
  });

  it('should throw when the limit is not a positive integer', () => {
    expect(() => new LimitedSet<string>({ limit: -1 })).toThrow(RangeError);
  });

  it('should never hold more than its limit', () => {
    const set = new LimitedSet<number>({ limit: 3 });

    for (let i = 0; i < 10; i += 1) {
      set.add(i);
      expect(set.size).toBeLessThanOrEqual(3);
    }

    expect([...set]).toEqual([7, 8, 9]);
  });

  it('should return itself from add, so calls chain', () => {
    const set = new LimitedSet<string>({ limit: 2 });
    expect(set.add('a').add('b')).toBe(set);
  });

  describe('initial values', () => {
    it('should add them in order', () => {
      const set = new LimitedSet<string>({ limit: 3 }, ['a', 'b']);
      expect([...set]).toEqual(['a', 'b']);
    });

    it('should trim initial values over the limit, evicting through onEvict', () => {
      const onEvict = vi.fn();
      const set = new LimitedSet<string>({ limit: 2, onEvict }, new Set(['a', 'b', 'c']));

      expect([...set]).toEqual(['b', 'c']);
      expect(onEvict.mock.calls).toEqual([['a']]);
    });
  });

  describe("order: 'recent'", () => {
    it('should refresh a value that is added again', () => {
      const set = new LimitedSet<string>({ limit: 2 });
      set.add('a').add('b').add('a').add('c');

      expect([...set]).toEqual(['a', 'c']);
    });

    it('should not refresh a value on has', () => {
      const set = new LimitedSet<string>({ limit: 2 });
      set.add('a').add('b');

      expect(set.has('a')).toBe(true);
      set.add('c');

      expect([...set]).toEqual(['b', 'c']);
    });
  });

  describe("order: 'insertion'", () => {
    it('should not refresh a value that is added again', () => {
      const set = new LimitedSet<string>({ limit: 2, order: 'insertion' });
      set.add('a').add('b').add('a').add('c');

      expect([...set]).toEqual(['b', 'c']);
    });
  });

  it('should pass each evicted value to onEvict, oldest first', () => {
    const onEvict = vi.fn();
    const set = new LimitedSet<string>({ limit: 1, onEvict });
    set.add('a').add('b').add('c');

    expect(onEvict.mock.calls).toEqual([['a'], ['b']]);
  });

  it('should not call onEvict on delete or clear', () => {
    const onEvict = vi.fn();
    const set = new LimitedSet<string>({ limit: 3, onEvict });
    set.add('a').add('b').add('c');

    expect(set.delete('a')).toBe(true);
    expect([...set]).toEqual(['b', 'c']);

    set.clear();
    expect(set.size).toBe(0);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('should keep the cap after a clear', () => {
    const set = new LimitedSet<string>({ limit: 1 });
    set.add('a');
    set.clear();
    set.add('b').add('c');

    expect([...set]).toEqual(['c']);
  });
});
