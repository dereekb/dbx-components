import { flattenObject } from './object.flatten';

describe('flattenObject', () => {
  it('should return an empty object for null input', () => {
    expect(flattenObject(null)).toEqual({});
  });

  it('should return an empty object for undefined input', () => {
    expect(flattenObject(undefined)).toEqual({});
  });

  it('should return an empty object for empty input', () => {
    expect(flattenObject({})).toEqual({});
  });

  it('should pass through a flat object unchanged', () => {
    const input = { a: 1, b: 'hello', c: true };
    expect(flattenObject(input)).toEqual({ a: 1, b: 'hello', c: true });
  });

  it('should flatten single-level nesting', () => {
    const input = { a: 1, b: { c: 2 } };
    expect(flattenObject(input)).toEqual({ a: 1, 'b.c': 2 });
  });

  it('should flatten multi-level nesting', () => {
    const input = { a: { b: { c: 1 } } };
    expect(flattenObject(input)).toEqual({ 'a.b.c': 1 });
  });

  it('should flatten mixed nesting depths', () => {
    const input = { a: 1, b: { c: 'hi', d: { e: true } }, f: false };
    expect(flattenObject(input)).toEqual({
      a: 1,
      'b.c': 'hi',
      'b.d.e': true,
      f: false
    });
  });

  it('should not flatten arrays', () => {
    const input = { a: [1, 2, 3], b: { c: [4, 5] } };
    expect(flattenObject(input)).toEqual({ a: [1, 2, 3], 'b.c': [4, 5] });
  });

  it('should not flatten Date objects', () => {
    const date = new Date();
    const input = { a: date };
    expect(flattenObject(input)).toEqual({ a: date });
  });

  it('should not flatten RegExp objects', () => {
    const regex = /test/;
    const input = { a: regex };
    expect(flattenObject(input)).toEqual({ a: regex });
  });

  it('should omit empty nested objects', () => {
    const input = { a: {} };
    expect(flattenObject(input)).toEqual({});
  });

  it('should omit deeply empty nested objects', () => {
    const input = { a: { b: {} } };
    expect(flattenObject(input)).toEqual({});
  });

  it('should preserve null and undefined values as leaves', () => {
    const input = { a: null, b: undefined, c: 1 };
    expect(flattenObject(input)).toEqual({ a: null, b: undefined, c: 1 });
  });

  describe('with custom separator', () => {
    it('should use the provided separator', () => {
      const input = { a: { b: 1 } };
      expect(flattenObject(input, { separator: '_' })).toEqual({ a_b: 1 });
    });

    it('should use the provided separator for deep nesting', () => {
      const input = { a: { b: { c: 1 } } };
      expect(flattenObject(input, { separator: '/' })).toEqual({ 'a/b/c': 1 });
    });
  });

  describe('with maxDepth', () => {
    it('should stop flattening at the specified depth', () => {
      const input = { a: { b: { c: 1 } } };
      expect(flattenObject(input, { maxDepth: 1 })).toEqual({ 'a.b': { c: 1 } });
    });

    it('should flatten fully when depth is sufficient', () => {
      const input = { a: { b: { c: 1 } } };
      expect(flattenObject(input, { maxDepth: 10 })).toEqual({ 'a.b.c': 1 });
    });

    it('should not flatten any nesting at maxDepth 0', () => {
      const input = { a: { b: 1 }, c: 2 };
      expect(flattenObject(input, { maxDepth: 0 })).toEqual({ a: { b: 1 }, c: 2 });
    });
  });

  describe('circular references', () => {
    it('should not recurse into a self-referencing object', () => {
      const input: Record<string, unknown> = { a: 1 };
      input['self'] = input;

      const result = flattenObject(input);
      expect(result['a']).toBe(1);
      expect(result['self']).toBe(input);
    });

    it('should not recurse into a circular reference between nested objects', () => {
      const child: Record<string, unknown> = { x: 'hello' };
      const input: Record<string, unknown> = { a: 1, b: child };
      child['parent'] = input;

      const result = flattenObject(input);
      expect(result['a']).toBe(1);
      expect(result['b.x']).toBe('hello');
      expect(result['b.parent']).toBe(input);
    });

    it('should handle the same object referenced from multiple keys without circular recursion', () => {
      const shared: Record<string, unknown> = { v: 42 };
      const input: Record<string, unknown> = { a: shared, b: shared };

      const result = flattenObject(input);
      expect(result['a.v']).toBe(42);
      // second reference to same object is treated as a leaf since it was already visited
      expect(result['b']).toBe(shared);
    });
  });
});
