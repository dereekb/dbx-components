import { makeUrlSearchParams, makeUrlSearchParamsString, toBracketNotationSearchParamTuples, updateUrlSearchParams } from './fetch.url';

describe('makeUrlSearchParams()', () => {
  it('should create URLSearchParams from an object', () => {
    const result = makeUrlSearchParams({ a: '1', b: '2' });
    expect(result.get('a')).toBe('1');
    expect(result.get('b')).toBe('2');
  });

  it('should merge multiple objects', () => {
    const result = makeUrlSearchParams([{ a: '1' }, { b: '2' }]);
    expect(result.get('a')).toBe('1');
    expect(result.get('b')).toBe('2');
  });

  it('should filter empty values by default', () => {
    const result = makeUrlSearchParams({ a: '1', b: null, c: undefined });
    expect(result.get('a')).toBe('1');
    expect(result.has('b')).toBe(false);
    expect(result.has('c')).toBe(false);
  });

  it('should omit specified keys', () => {
    const result = makeUrlSearchParams({ a: '1', b: '2', c: '3' }, { omitKeys: ['b', 'c'] });
    expect(result.get('a')).toBe('1');
    expect(result.has('b')).toBe(false);
    expect(result.has('c')).toBe(false);
  });

  it('should collapse a nested object to [object Object] by default', () => {
    const result = makeUrlSearchParams({ a: { b: '1' } });
    expect(result.get('a')).toBe('[object Object]');
  });

  it('should expand nested values into bracket notation when useBracketNotation is true', () => {
    const result = makeUrlSearchParams({ calendarsToLoad: [{ credentialId: 1845764, externalId: 'a@b.com' }] }, { useBracketNotation: true });
    expect(result.get('calendarsToLoad[0][credentialId]')).toBe('1845764');
    expect(result.get('calendarsToLoad[0][externalId]')).toBe('a@b.com');
    expect(result.has('calendarsToLoad')).toBe(false);
  });

  it('should leave scalar values unchanged when useBracketNotation is true', () => {
    const result = makeUrlSearchParams({ dateFrom: '2026-08-01', limit: 5 }, { useBracketNotation: true });
    expect(result.get('dateFrom')).toBe('2026-08-01');
    expect(result.get('limit')).toBe('5');
  });
});

describe('toBracketNotationSearchParamTuples()', () => {
  it('should return an empty array for nullish input', () => {
    expect(toBracketNotationSearchParamTuples(null)).toEqual([]);
    expect(toBracketNotationSearchParamTuples(undefined)).toEqual([]);
  });

  it('should pass scalar values through unchanged', () => {
    expect(toBracketNotationSearchParamTuples({ a: '1', b: 2, c: true })).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', 'true']
    ]);
  });

  it('should index array entries', () => {
    expect(toBracketNotationSearchParamTuples({ a: ['x', 'y'] })).toEqual([
      ['a[0]', 'x'],
      ['a[1]', 'y']
    ]);
  });

  it('should key nested object properties', () => {
    expect(toBracketNotationSearchParamTuples({ a: { b: '1' } })).toEqual([['a[b]', '1']]);
  });

  it('should recurse through arrays of objects', () => {
    expect(toBracketNotationSearchParamTuples({ a: [{ b: 1 }, { b: 2 }] })).toEqual([
      ['a[0][b]', '1'],
      ['a[1][b]', '2']
    ]);
  });

  it('should recurse through deeply nested values', () => {
    expect(toBracketNotationSearchParamTuples({ a: { b: [{ c: 'd' }] } })).toEqual([['a[b][0][c]', 'd']]);
  });

  it('should skip nullish leaves rather than stringify them', () => {
    expect(toBracketNotationSearchParamTuples({ a: null, b: undefined, c: '1' })).toEqual([['c', '1']]);
  });

  it('should emit nothing for an empty array or object', () => {
    expect(toBracketNotationSearchParamTuples({ a: [], b: {} })).toEqual([]);
  });
});

describe('makeUrlSearchParamsString()', () => {
  it('should return a query string', () => {
    const result = makeUrlSearchParamsString({ a: '1', b: '2' });
    expect(result).toBe('a=1&b=2');
  });

  it('should encode spaces as %20 when useUrlSearchSpaceHandling is true', () => {
    const result = makeUrlSearchParamsString({ scope: 'openid profile' }, { useUrlSearchSpaceHandling: true });
    expect(result).toBe('scope=openid%20profile');
  });

  it('should encode spaces as + by default', () => {
    const result = makeUrlSearchParamsString({ scope: 'openid profile' });
    expect(result).toBe('scope=openid+profile');
  });
});

describe('updateUrlSearchParams()', () => {
  it('should add params to a URL with no existing query string', () => {
    const result = updateUrlSearchParams('https://example.com/form', { name: 'Alice', age: 30 });
    expect(result).toBe('https://example.com/form?name=Alice&age=30');
  });

  it('should override existing params', () => {
    const result = updateUrlSearchParams('https://example.com?page=1&sort=asc', { page: 2 });
    expect(result).toBe('https://example.com?page=2&sort=asc');
  });

  it('should preserve existing params that are not overridden', () => {
    const result = updateUrlSearchParams('https://example.com?a=1&b=2', { c: '3' });
    expect(result).toContain('a=1');
    expect(result).toContain('b=2');
    expect(result).toContain('c=3');
  });

  it('should return the URL unchanged when params is null', () => {
    const result = updateUrlSearchParams('https://example.com?a=1', null);
    expect(result).toBe('https://example.com?a=1');
  });

  it('should return the base URL when existing and new params are both empty', () => {
    const result = updateUrlSearchParams('https://example.com', null);
    expect(result).toBe('https://example.com');
  });

  it('should encode spaces as %20 when useUrlSearchSpaceHandling is true', () => {
    const result = updateUrlSearchParams('https://example.com', { scope: 'openid profile' }, { useUrlSearchSpaceHandling: true });
    expect(result).toBe('https://example.com?scope=openid%20profile');
  });

  it('should omit keys from the merged result', () => {
    const result = updateUrlSearchParams('https://example.com?a=1&b=2', { c: '3' }, { omitKeys: ['b'] });
    expect(result).toContain('a=1');
    expect(result).toContain('c=3');
    expect(result).not.toContain('b=');
  });

  it('should filter empty values from new params by default', () => {
    const result = updateUrlSearchParams('https://example.com?a=1', { b: null, c: '3' });
    expect(result).toContain('a=1');
    expect(result).toContain('c=3');
    expect(result).not.toContain('b=');
  });

  it('should handle a URL with a path and fragment-free query', () => {
    const result = updateUrlSearchParams('https://example.com/api/v1?token=abc', { format: 'json' });
    expect(result).toBe('https://example.com/api/v1?token=abc&format=json');
  });
});
