import { mapPromiseOrValue } from './map';

describe('mapPromiseOrValue()', () => {
  it('should synchronously map a non-Promise value', () => {
    const result = mapPromiseOrValue(5, (x) => x * 2);
    expect(result).toBe(10);
  });

  it('should asynchronously map a Promise value', async () => {
    const result = mapPromiseOrValue(Promise.resolve(5), (x) => x * 2);
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(10);
  });

  it('should handle string transformation', () => {
    const result = mapPromiseOrValue('hello', (x) => x.toUpperCase());
    expect(result).toBe('HELLO');
  });

  it('should handle mapping to a different type', async () => {
    const result = mapPromiseOrValue(Promise.resolve(42), (x) => String(x));
    expect(await result).toBe('42');
  });
});
