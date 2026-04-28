import { asAnalyticsEventData } from './analytics.event.util';

describe('asAnalyticsEventData', () => {
  it('should return an empty object for null input', () => {
    expect(asAnalyticsEventData(null)).toEqual({});
  });

  it('should return an empty object for undefined input', () => {
    expect(asAnalyticsEventData(undefined)).toEqual({});
  });

  it('should return an empty object for empty input', () => {
    expect(asAnalyticsEventData({})).toEqual({});
  });

  it('should keep valid primitive values', () => {
    const input = { a: 'hello', b: 42, c: true, d: false, e: 0, f: '' };

    expect(asAnalyticsEventData(input)).toEqual({
      a: 'hello',
      b: 42,
      c: true,
      d: false,
      e: 0,
      f: ''
    });
  });

  describe('flattening', () => {
    it('should flatten nested objects and keep primitive values', () => {
      const input = { a: 'ok', b: { nested: 1 } };

      expect(asAnalyticsEventData(input)).toEqual({
        a: 'ok',
        'b.nested': 1
      });
    });

    it('should flatten deeply nested objects', () => {
      const input = { a: { b: { c: 'deep' } } };

      expect(asAnalyticsEventData(input)).toEqual({
        'a.b.c': 'deep'
      });
    });

    it('should use custom separator when provided', () => {
      const input = { a: { b: 1 } };

      expect(asAnalyticsEventData(input, { separator: '_' })).toEqual({
        a_b: 1
      });
    });

    it('should respect maxDepth and filter remaining objects', () => {
      const input = { a: { b: { c: 1 } } };

      // maxDepth 1 flattens one level, leaving { c: 1 } as a value which gets filtered out
      expect(asAnalyticsEventData(input, { maxDepth: 1 })).toEqual({});
    });
  });

  describe('filtering', () => {
    it('should filter out null and undefined values', () => {
      const input = { a: 'ok', b: null, c: undefined };

      expect(asAnalyticsEventData(input)).toEqual({ a: 'ok' });
    });

    it('should filter out arrays', () => {
      const input = { a: 'ok', b: [1, 2, 3] };

      expect(asAnalyticsEventData(input)).toEqual({ a: 'ok' });
    });

    it('should filter out functions', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const input = { a: 'ok', b: () => {} };

      expect(asAnalyticsEventData(input)).toEqual({ a: 'ok' });
    });

    it('should filter out Date objects', () => {
      const input = { a: 'ok', b: new Date() };

      expect(asAnalyticsEventData(input)).toEqual({ a: 'ok' });
    });

    it('should filter out symbols', () => {
      const input = { a: 'ok', b: Symbol('x') };

      expect(asAnalyticsEventData(input)).toEqual({ a: 'ok' });
    });

    it('should filter out NaN', () => {
      const input = { a: 1, b: Number.NaN };

      expect(asAnalyticsEventData(input)).toEqual({ a: 1 });
    });

    it('should filter out Infinity and -Infinity', () => {
      const input = { a: 1, b: Infinity, c: -Infinity };

      expect(asAnalyticsEventData(input)).toEqual({ a: 1 });
    });
  });

  describe('with flattenObjects disabled', () => {
    it('should not flatten nested objects and filter them out', () => {
      const input = { a: 'ok', b: { nested: 1 } };

      expect(asAnalyticsEventData(input, { flattenObjects: false })).toEqual({ a: 'ok' });
    });
  });

  describe('mixed complex objects', () => {
    it('should handle a complex object with mixed value types', () => {
      const input = {
        name: 'test_event',
        count: 5,
        active: true,
        user: {
          age: 30,
          role: 'admin',
          settings: {
            darkMode: true,
            notifications: false
          }
        },
        tags: ['a', 'b'],
        meta: null,
        callback: () => undefined,
        score: Number.NaN,
        timestamp: new Date()
      };

      expect(asAnalyticsEventData(input)).toEqual({
        name: 'test_event',
        count: 5,
        active: true,
        'user.age': 30,
        'user.role': 'admin',
        'user.settings.darkMode': true,
        'user.settings.notifications': false
      });
    });
  });
});
