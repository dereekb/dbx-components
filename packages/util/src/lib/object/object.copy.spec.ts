import { describe, expect, it } from 'vitest';
import { KeyValueTypleValueFilter } from './object.filter.tuple';
import { copyValueDeep, copyValueDeepFunction, copyValueWithoutNullAndUndefinedValues, copyValueWithoutUndefinedValues } from './object.copy';

describe('copyValueDeep()', () => {
  it('should return primitive values as-is', () => {
    expect(copyValueDeep(1)).toBe(1);
    expect(copyValueDeep('a')).toBe('a');
    expect(copyValueDeep(true)).toBe(true);
    expect(copyValueDeep(null)).toBeNull();
    expect(copyValueDeep(undefined)).toBeUndefined();
  });

  it('should copy the object instead of returning the input', () => {
    const input = { a: 1, b: { c: 2 } };
    const result = copyValueDeep(input);

    expect(result).not.toBe(input);
    expect(result.b).not.toBe(input.b);
    expect(result).toEqual(input);
  });

  it('should copy arrays instead of returning the input', () => {
    const input = [{ a: 1 }, [2]];
    const result = copyValueDeep(input);

    expect(result).not.toBe(input);
    expect(result[0]).not.toBe(input[0]);
    expect(result[1]).not.toBe(input[1]);
    expect(result).toEqual(input);
  });

  it('should not mutate the input', () => {
    const input = { a: 1, b: undefined, c: { d: undefined } };
    copyValueDeep(input);

    expect(Object.keys(input)).toContain('b');
    expect(Object.keys(input.c)).toContain('d');
  });

  it('should remove undefined values by default', () => {
    expect(copyValueDeep({ a: 1, b: undefined })).toEqual({ a: 1 });
    expect(Object.keys(copyValueDeep({ a: 1, b: undefined }))).not.toContain('b');
  });

  it('should remove undefined values at any depth', () => {
    const result = copyValueDeep({ a: { b: { c: undefined, d: 1 } } });

    expect(result).toEqual({ a: { b: { d: 1 } } });
    expect(Object.keys(result.a.b)).not.toContain('c');
  });

  it('should remove undefined values nested within arrays', () => {
    const result = copyValueDeep({ a: [{ b: undefined, c: 1 }] });

    expect(result).toEqual({ a: [{ c: 1 }] });
    expect(Object.keys(result.a[0])).not.toContain('b');
  });

  it('should retain null values by default', () => {
    expect(copyValueDeep({ a: null, b: { c: null } })).toEqual({ a: null, b: { c: null } });
  });

  it('should retain a Date by reference', () => {
    // A Date copied key-by-key becomes {}, which is why non-plain objects are retained as-is.
    const date = new Date();
    const result = copyValueDeep({ a: { b: date } });

    expect(result.a.b).toBe(date);
  });

  it('should retain Map/Set/class instances by reference', () => {
    class TestClass {
      readonly value = 1;
    }

    const map = new Map([['a', 1]]);
    const set = new Set([1]);
    const instance = new TestClass();
    const result = copyValueDeep({ map, set, instance });

    expect(result.map).toBe(map);
    expect(result.set).toBe(set);
    expect(result.instance).toBe(instance);
  });

  it('should copy a value referenced twice only once', () => {
    const shared = { a: 1 };
    const result = copyValueDeep({ x: shared, y: shared });

    expect(result.x).not.toBe(shared);
    expect(result.x).toBe(result.y);
  });

  it('should terminate on a cyclical reference', () => {
    const input: { a: number; self?: unknown } = { a: 1 };
    input.self = input;

    const result = copyValueDeep(input);

    expect(result).not.toBe(input);
    expect(result.self).toBe(result);
  });

  describe('filter', () => {
    it('should remove null and undefined values with the NULL filter', () => {
      const result = copyValueDeep({ a: 1, b: null, c: { d: null, e: undefined, f: 0 } }, { filter: KeyValueTypleValueFilter.NULL });
      expect(result).toEqual({ a: 1, c: { f: 0 } });
    });

    it('should remove falsy values with the FALSY filter', () => {
      const result = copyValueDeep({ a: 1, b: 0, c: { d: '', e: 'x' } }, { filter: KeyValueTypleValueFilter.FALSY });
      expect(result).toEqual({ a: 1, c: { e: 'x' } });
    });

    it('should retain every value with the NONE filter', () => {
      const input = { a: undefined, b: null, c: { d: undefined } };
      const result = copyValueDeep(input, { filter: KeyValueTypleValueFilter.NONE });

      expect(result).not.toBe(input);
      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
      expect(Object.keys(result.c)).toEqual(['d']);
    });

    it('should not filter the root value', () => {
      // The filter is a decision about a key/value pair, and the root has no key.
      expect(copyValueDeep(undefined)).toBeUndefined();
      expect(copyValueDeep(null, { filter: KeyValueTypleValueFilter.NULL })).toBeNull();
    });
  });

  describe('arrayValues', () => {
    it('should remove filtered array values by default', () => {
      expect(copyValueDeep([1, undefined, 2])).toEqual([1, 2]);
    });

    it('should retain filtered array values when retain', () => {
      const result = copyValueDeep([1, undefined, 2], { arrayValues: 'retain' });

      expect(result.length).toBe(3);
      expect(result[1]).toBeUndefined();
    });

    it('should replace filtered array values with null when nullify', () => {
      expect(copyValueDeep([1, undefined, 2], { arrayValues: 'nullify' })).toEqual([1, null, 2]);
    });

    it('should still filter values nested within a retained array value', () => {
      const result = copyValueDeep([{ a: undefined, b: 1 }], { arrayValues: 'retain' });
      expect(result).toEqual([{ b: 1 }]);
    });
  });

  describe('filterEmptyValues', () => {
    it('should retain emptied objects by default', () => {
      expect(copyValueDeep({ a: { b: undefined } })).toEqual({ a: {} });
    });

    it('should remove emptied objects when true', () => {
      expect(copyValueDeep({ a: { b: undefined }, c: 1 }, { filterEmptyValues: true })).toEqual({ c: 1 });
    });

    it('should remove emptied arrays when true', () => {
      expect(copyValueDeep({ a: [undefined], c: 1 }, { filterEmptyValues: true })).toEqual({ c: 1 });
    });

    it('should remove objects emptied at multiple depths when true', () => {
      expect(copyValueDeep({ a: { b: { c: undefined } }, d: 1 }, { filterEmptyValues: true })).toEqual({ d: 1 });
    });

    it('should not treat a Date as empty', () => {
      const date = new Date();
      expect(copyValueDeep({ a: date }, { filterEmptyValues: true })).toEqual({ a: date });
    });
  });

  describe('transform', () => {
    it('should transform each value before it is copied', () => {
      const result = copyValueDeep({ a: 1, b: { c: 2 } }, { transform: (value) => (typeof value === 'number' ? value * 2 : value) });
      expect(result).toEqual({ a: 2, b: { c: 4 } });
    });

    it('should pass the key of the value being transformed', () => {
      const keys: unknown[] = [];
      copyValueDeep(
        { a: { b: [1] } },
        {
          transform: (value, key) => {
            keys.push(key);
            return value;
          }
        }
      );

      // the root has no key, and an array value's key is its index
      expect(keys).toEqual([undefined, 'a', 'b', 0]);
    });

    it('should filter a value the transform turned into a filtered value', () => {
      const result = copyValueDeep({ a: 1, b: 2 }, { transform: (value) => (value === 2 ? undefined : value) });
      expect(result).toEqual({ a: 1 });
    });

    it('should recurse into the transformed value', () => {
      const result = copyValueDeep({ a: 'replace' }, { transform: (value) => (value === 'replace' ? { b: undefined, c: 1 } : value) });
      expect(result).toEqual({ a: { c: 1 } });
    });
  });
});

describe('copyValueDeepFunction()', () => {
  it('should be reusable across values', () => {
    const copyFn = copyValueDeepFunction({ filter: KeyValueTypleValueFilter.NULL });

    expect(copyFn({ a: null, b: 1 })).toEqual({ b: 1 });
    expect(copyFn({ c: undefined, d: 2 })).toEqual({ d: 2 });
  });

  it('should not share the reference tracking between calls', () => {
    const copyFn = copyValueDeepFunction();
    const shared = { a: 1 };

    const first = copyFn({ shared });
    const second = copyFn({ shared });

    expect(first.shared).not.toBe(second.shared);
  });
});

describe('copyValueWithoutUndefinedValues', () => {
  it('should remove undefined values at any depth', () => {
    expect(copyValueWithoutUndefinedValues({ a: 1, b: undefined, c: [{ d: undefined }] })).toEqual({ a: 1, c: [{}] });
  });

  it('should retain null values', () => {
    expect(copyValueWithoutUndefinedValues({ a: null })).toEqual({ a: null });
  });
});

describe('copyValueWithoutNullAndUndefinedValues', () => {
  it('should remove null and undefined values at any depth', () => {
    expect(copyValueWithoutNullAndUndefinedValues({ a: 1, b: null, c: { d: undefined, e: null, f: 2 } })).toEqual({ a: 1, c: { f: 2 } });
  });
});
