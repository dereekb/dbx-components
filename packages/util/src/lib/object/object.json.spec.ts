import { describe, it, expect } from 'vitest';
import { findNonJsonCompatibleValue, isJsonCompatibleValue, jsonIncompatibilityMessage, type JsonCompatible } from './object.json';

describe('findNonJsonCompatibleValue()', () => {
  it('should return undefined for plain JSON values', () => {
    expect(findNonJsonCompatibleValue(null)).toBeUndefined();
    expect(findNonJsonCompatibleValue('a')).toBeUndefined();
    expect(findNonJsonCompatibleValue(1)).toBeUndefined();
    expect(findNonJsonCompatibleValue(true)).toBeUndefined();
    expect(findNonJsonCompatibleValue([1, 'a', null, { b: [true] }])).toBeUndefined();
    expect(findNonJsonCompatibleValue({ a: { b: [1, 2, { c: 'd' }] } })).toBeUndefined();
    expect(findNonJsonCompatibleValue(Object.create(null))).toBeUndefined();
  });

  it('should allow undefined object properties', () => {
    expect(findNonJsonCompatibleValue({ a: undefined })).toBeUndefined();
  });

  it('should allow the same object referenced twice (non-circular)', () => {
    const shared = { a: 1 };
    expect(findNonJsonCompatibleValue({ x: shared, y: shared })).toBeUndefined();
  });

  it('should reject a Date', () => {
    expect(findNonJsonCompatibleValue(new Date())).toEqual({ path: '', reason: 'date' });
  });

  it('should reject a function', () => {
    expect(findNonJsonCompatibleValue({ fn: () => 1 })).toEqual({ path: 'fn', reason: 'function' });
  });

  it('should reject a Map and a Set', () => {
    expect(findNonJsonCompatibleValue({ m: new Map() })).toEqual({ path: 'm', reason: 'map' });
    expect(findNonJsonCompatibleValue({ s: new Set() })).toEqual({ path: 's', reason: 'set' });
  });

  it('should reject a class instance', () => {
    class TestClass {
      readonly a = 1;
    }

    expect(findNonJsonCompatibleValue({ x: new TestClass() })).toEqual({ path: 'x', reason: 'class_instance' });
  });

  it('should reject NaN and Infinity', () => {
    expect(findNonJsonCompatibleValue({ n: Number.NaN })).toEqual({ path: 'n', reason: 'non_finite_number' });
    expect(findNonJsonCompatibleValue([Infinity])).toEqual({ path: '[0]', reason: 'non_finite_number' });
  });

  it('should reject a bigint and a symbol', () => {
    expect(findNonJsonCompatibleValue({ b: BigInt(1) })).toEqual({ path: 'b', reason: 'bigint' });
    expect(findNonJsonCompatibleValue({ s: Symbol('s') })).toEqual({ path: 's', reason: 'symbol' });
  });

  it('should reject an undefined array item', () => {
    expect(findNonJsonCompatibleValue({ a: [1, undefined] })).toEqual({ path: 'a[1]', reason: 'undefined_in_array' });
  });

  it('should reject a circular reference', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    expect(findNonJsonCompatibleValue(a)).toEqual({ path: 'self', reason: 'circular' });
  });

  it('should return the path of a nested value', () => {
    expect(findNonJsonCompatibleValue({ a: [1, { b: { c: new Date() } }] })).toEqual({ path: 'a[1].b.c', reason: 'date' });
  });
});

describe('isJsonCompatibleValue()', () => {
  it('should return true for JSON values', () => {
    expect(isJsonCompatibleValue({ a: [1, 'b'] })).toBe(true);
  });

  it('should return false for non-JSON values', () => {
    expect(isJsonCompatibleValue({ a: new Date() })).toBe(false);
  });
});

describe('jsonIncompatibilityMessage()', () => {
  it('should describe the path and the reason', () => {
    expect(jsonIncompatibilityMessage({ path: 'a.b', reason: 'date' })).toBe('"a.b" is a Date, which is not JSON-compatible.');
    expect(jsonIncompatibilityMessage({ path: '', reason: 'function' })).toBe('The value is a function, which is not JSON-compatible.');
  });
});

describe('JsonCompatible', () => {
  it('should accept JSON-compatible types', () => {
    interface TestValue {
      readonly a: string;
      readonly b?: number;
      readonly c: readonly { readonly d: boolean | null }[];
    }

    const value: JsonCompatible<TestValue> = { a: 'a', c: [{ d: null }] };
    expect(value.a).toBe('a');
  });

  it('should reject Date fields', () => {
    interface TestValue {
      readonly date: Date;
    }

    // @ts-expect-error a Date is not JSON-compatible
    const value: JsonCompatible<TestValue> = { date: new Date() };
    expect(value).toBeDefined();
  });
});
