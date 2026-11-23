import { describe, expect, it } from 'vitest';
import { parseJsonObjectOrUndefined, parseJsonOrUndefined, readJsonObjectFromText, scanJsonStringLiteral, sliceBalancedJsonObject } from './json';

describe('parseJsonOrUndefined()', () => {
  it('should parse any JSON value', () => {
    expect(parseJsonOrUndefined('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonOrUndefined<number[]>('[1,2]')).toEqual([1, 2]);
    expect(parseJsonOrUndefined('"text"')).toBe('text');
    expect(parseJsonOrUndefined('3')).toBe(3);
    expect(parseJsonOrUndefined('null')).toBeNull();
  });

  it('should return undefined for missing or malformed text', () => {
    expect(parseJsonOrUndefined('')).toBeUndefined();
    expect(parseJsonOrUndefined(null)).toBeUndefined();
    expect(parseJsonOrUndefined(undefined)).toBeUndefined();
    expect(parseJsonOrUndefined('{"a":')).toBeUndefined();
  });
});

describe('parseJsonObjectOrUndefined()', () => {
  it('should parse a JSON object', () => {
    expect(parseJsonObjectOrUndefined('{"a":{"b":[1]}}')).toEqual({ a: { b: [1] } });
  });

  it('should return undefined for arrays, primitives and null', () => {
    expect(parseJsonObjectOrUndefined('[1,2]')).toBeUndefined();
    expect(parseJsonObjectOrUndefined('"text"')).toBeUndefined();
    expect(parseJsonObjectOrUndefined('3')).toBeUndefined();
    expect(parseJsonObjectOrUndefined('null')).toBeUndefined();
  });

  it('should return undefined for missing or malformed text', () => {
    expect(parseJsonObjectOrUndefined('')).toBeUndefined();
    expect(parseJsonObjectOrUndefined(null)).toBeUndefined();
    expect(parseJsonObjectOrUndefined(undefined)).toBeUndefined();
    expect(parseJsonObjectOrUndefined('{"a": nope}')).toBeUndefined();
  });
});

describe('scanJsonStringLiteral()', () => {
  it('should find the closing quote', () => {
    expect(scanJsonStringLiteral({ text: '{"key":1}', start: 1 })).toEqual({ closed: true, end: 6, issues: [] });
  });

  it('should skip escaped quotes and backslashes', () => {
    const text = String.raw`"a \" b \\" tail`;
    expect(scanJsonStringLiteral({ text, start: 0 })).toEqual({ closed: true, end: 11, issues: [] });
  });

  it('should leave a literal unclosed when a backslash is the last character', () => {
    expect(scanJsonStringLiteral({ text: '"abc\\', start: 0 })).toEqual({ closed: false, end: 5, issues: [] });
  });

  it('should leave a literal unclosed at the end of the text', () => {
    expect(scanJsonStringLiteral({ text: '"abc', start: 0 })).toEqual({ closed: false, end: 4, issues: [] });
  });

  it('should record a raw control character as an issue and keep scanning', () => {
    expect(scanJsonStringLiteral({ text: '"a\nb\tc"', start: 0 })).toEqual({
      closed: true,
      end: 7,
      issues: [
        { kind: 'control-character', at: 2 },
        { kind: 'control-character', at: 4 }
      ]
    });
  });

  it('should not record an escaped control character', () => {
    expect(scanJsonStringLiteral({ text: '"a\\\nb"', start: 0 })).toEqual({ closed: true, end: 6, issues: [] });
  });

  it('should record an inner quote when the predicate says so', () => {
    const text = '"say "hi" now" ,';
    const quoteIndexes: number[] = [];
    const scan = scanJsonStringLiteral({
      text,
      start: 0,
      isInnerQuote: (_text, quoteIndex) => {
        quoteIndexes.push(quoteIndex);
        return quoteIndex < 13;
      }
    });

    expect(quoteIndexes).toEqual([5, 8, 13]);
    expect(scan).toEqual({
      closed: true,
      end: 14,
      issues: [
        { kind: 'inner-quote', at: 5 },
        { kind: 'inner-quote', at: 8 }
      ]
    });
  });
});

describe('sliceBalancedJsonObject()', () => {
  it('should slice a nested object', () => {
    expect(sliceBalancedJsonObject('x {"a":{"b":1}} y }', 2)).toBe('{"a":{"b":1}}');
  });

  it('should ignore braces inside strings', () => {
    expect(sliceBalancedJsonObject('{"a":"} {"} }', 0)).toBe('{"a":"} {"}');
  });

  it('should ignore escaped quotes inside strings', () => {
    expect(sliceBalancedJsonObject(String.raw`{"a":"\" }"}}`, 0)).toBe(String.raw`{"a":"\" }"}`);
  });

  it('should return undefined when the object never closes', () => {
    expect(sliceBalancedJsonObject('{"a":{"b":1}', 0)).toBeUndefined();
    expect(sliceBalancedJsonObject('{"a":"}', 0)).toBeUndefined();
  });
});

describe('readJsonObjectFromText()', () => {
  it('should read the greedy slice when it parses', () => {
    expect(readJsonObjectFromText('{"outer":{"inner":1}}')).toEqual({ found: true, value: { outer: { inner: 1 } } });
  });

  it('should read an object wrapped in prose and a code fence', () => {
    expect(readJsonObjectFromText('Sure!\n```json\n{"ok": true}\n```')).toEqual({ found: true, value: { ok: true } });
  });

  it('should rescue an object followed by a stray closing brace', () => {
    expect(readJsonObjectFromText('{"a":{"b":1}}}')).toEqual({ found: true, value: { a: { b: 1 } } });
  });

  it('should rescue an object followed by trailing prose holding a brace', () => {
    expect(readJsonObjectFromText('{"ok":true} ... hope that helps! }')).toEqual({ found: true, value: { ok: true } });
  });

  it('should ignore braces inside string literals when balancing', () => {
    expect(readJsonObjectFromText(String.raw`{"note":"a \" quote and a } brace"}}`).value).toEqual({ note: 'a " quote and a } brace' });
  });

  it('should resolve two top-level objects to the first', () => {
    expect(readJsonObjectFromText('{"first":1}\n{"second":2}').value).toEqual({ first: 1 });
  });

  it('should report no block when there is no brace pair', () => {
    expect(readJsonObjectFromText('only prose')).toEqual({ found: false });
    expect(readJsonObjectFromText('')).toEqual({ found: false });
    expect(readJsonObjectFromText(`{"products": ["${'\t'.repeat(200)}`)).toEqual({ found: false });
  });

  it('should report the first parse failure when no candidate parses', () => {
    const reading = readJsonObjectFromText('{"a": nope, not json}');
    expect(reading.found).toBe(true);
    expect(reading.value).toBeUndefined();
    expect(reading.error).toBeInstanceOf(SyntaxError);
  });

  it('should not resolve a truncated object to an inner object that closed', () => {
    const reading = readJsonObjectFromText('{"products":[{"name":"alpha","parts":[]},{"name":"be');
    expect(reading.found).toBe(true);
    expect(reading.value).toBeUndefined();
    expect(reading.error).toBeInstanceOf(SyntaxError);
  });

  it('should not report an error when a later candidate parses', () => {
    expect(readJsonObjectFromText('{"a":1}}')).toEqual({ found: true, value: { a: 1 } });
  });
});
