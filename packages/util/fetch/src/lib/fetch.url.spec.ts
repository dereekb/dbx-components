import { makeUrlSearchParams, makeUrlSearchParamsString, updateUrlSearchParams } from './fetch.url';

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
    const result = makeUrlSearchParams({ a: '1', b: null, c: undefined } as any);
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
    const result = updateUrlSearchParams('https://example.com?a=1', { b: null, c: '3' } as any);
    expect(result).toContain('a=1');
    expect(result).toContain('c=3');
    expect(result).not.toContain('b=');
  });

  it('should handle a URL with a path and fragment-free query', () => {
    const result = updateUrlSearchParams('https://example.com/api/v1?token=abc', { format: 'json' });
    expect(result).toBe('https://example.com/api/v1?token=abc&format=json');
  });
});
