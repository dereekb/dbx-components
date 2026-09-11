import { describe, expect, it } from 'vitest';
import { CLI_DATA_CACHE_CYCLE_ERROR_CODE, CLI_DATA_CACHE_UNSUPPORTED_VALUE_ERROR_CODE, fromCliCacheJson, toCliCacheJson } from './data-cache.codec';

/**
 * Encodes, serializes, parses, and decodes — the full disk round trip, which is what the codec has
 * to survive. Encoding alone would hide the `JSON.stringify` losses the codec exists to prevent.
 */
function roundTrip<T>(value: T): T {
  return fromCliCacheJson(JSON.parse(JSON.stringify(toCliCacheJson(value)))) as T;
}

describe('toCliCacheJson()/fromCliCacheJson()', () => {
  it('round-trips the JSON primitives unchanged', () => {
    expect(roundTrip({ s: 'a', n: 1, t: true, f: false, z: null })).toEqual({ s: 'a', n: 1, t: true, f: false, z: null });
  });

  it('round-trips a Date as a Date', () => {
    const date = new Date('2026-09-08T12:34:56.789Z');
    const result = roundTrip({ at: date });
    expect(result.at).toBeInstanceOf(Date);
    expect(result.at.getTime()).toBe(date.getTime());
  });

  it('keeps a Date distinguishable from the ISO string it serializes to', () => {
    // the reason the codec pre-walks instead of using a JSON.stringify replacer: `Date.toJSON` runs
    // FIRST, so a replacer is handed a string and cannot tell the two apart. Every dbx model stores
    // its dates as ISO strings, so conflating them would silently degrade every cached model.
    const result = roundTrip({ date: new Date('2026-09-08T00:00:00.000Z'), text: '2026-09-08T00:00:00.000Z' });
    expect(result.date).toBeInstanceOf(Date);
    expect(typeof result.text).toBe('string');
  });

  it('round-trips an Invalid Date rather than throwing', () => {
    const result = roundTrip({ at: new Date(Number.NaN) });
    expect(result.at).toBeInstanceOf(Date);
    expect(Number.isNaN(result.at.getTime())).toBe(true);
  });

  it('round-trips a Map, including its value types', () => {
    const map = new Map<string, { readonly at: Date }>([['a', { at: new Date('2026-01-01T00:00:00.000Z') }]]);
    const result = roundTrip({ map });
    expect(result.map).toBeInstanceOf(Map);
    expect(result.map.get('a')?.at).toBeInstanceOf(Date);
  });

  it('round-trips a Set', () => {
    const result = roundTrip({ set: new Set(['a', 'b']) });
    expect(result.set).toBeInstanceOf(Set);
    expect([...result.set]).toEqual(['a', 'b']);
  });

  it('keeps a key whose value is undefined, distinct from an absent key', () => {
    // `JSON.stringify` DROPS an undefined-valued property, which would turn an explicitly-unset
    // field into a missing one — exactly the drift that makes a cached row differ from a live one
    const result = roundTrip({ set: undefined, other: 1 } as { set?: number; other: number });
    expect('set' in result).toBe(true);
    expect(result.set).toBeUndefined();
  });

  it('round-trips non-finite numbers, which JSON renders as null', () => {
    const result = roundTrip({ nan: Number.NaN, inf: Number.POSITIVE_INFINITY, ninf: Number.NEGATIVE_INFINITY });
    expect(Number.isNaN(result.nan)).toBe(true);
    expect(result.inf).toBe(Number.POSITIVE_INFINITY);
    expect(result.ninf).toBe(Number.NEGATIVE_INFINITY);
  });

  it('round-trips a bigint, which JSON throws on', () => {
    expect(roundTrip({ big: 90071992547409911n }).big).toBe(90071992547409911n);
  });

  it('round-trips nested arrays and objects', () => {
    const value = { rows: [{ id: 'a', at: new Date('2026-02-03T04:05:06.000Z'), tags: ['x', 'y'] }] };
    expect(roundTrip(value)).toEqual(value);
  });

  it('round-trips a plain object that looks like a tag envelope', () => {
    // real data can be shaped exactly like the codec's own envelope; the escape wrapper is what
    // keeps decoding from reading it back as a Date
    const value = { payload: { $d: '2026-09-08T00:00:00.000Z' } };
    const result = roundTrip(value);
    expect(result.payload).toEqual({ $d: '2026-09-08T00:00:00.000Z' });
    expect(result.payload).not.toBeInstanceOf(Date);
  });

  it('flattens a class instance to its own enumerable properties', () => {
    class Row {
      constructor(readonly id: string) {}
      get upper(): string {
        return this.id.toUpperCase();
      }
    }

    expect(roundTrip({ row: new Row('a') }).row).toEqual({ id: 'a' });
  });

  it('throws on a reference cycle', () => {
    const value: Record<string, unknown> = { id: 'a' };
    value['self'] = value;
    expect(() => toCliCacheJson(value)).toThrow(expect.objectContaining({ code: CLI_DATA_CACHE_CYCLE_ERROR_CODE }));
  });

  it('does not mistake a repeated (non-cyclic) reference for a cycle', () => {
    const shared = { id: 'a' };
    expect(toCliCacheJson({ first: shared, second: shared })).toEqual({ first: { id: 'a' }, second: { id: 'a' } });
  });

  it('throws on a function, rather than silently dropping it', () => {
    // a live reference in a cached value means the wrong thing is being cached — a query manifest
    // entry with a bound factory, say. Dropping it would produce a payload that decodes fine and
    // then fails somewhere far away.
    expect(() => toCliCacheJson({ factory: () => [] })).toThrow(expect.objectContaining({ code: CLI_DATA_CACHE_UNSUPPORTED_VALUE_ERROR_CODE }));
  });
});
