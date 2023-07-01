import { objectHasKey, objectHasKeys } from './object';

describe('objectHasKey()', () => {
  it('should return true if the object has the specified key.', () => {
    const key = 'a';
    const x = { [key]: 1 };
    expect(objectHasKey(x, key)).toBe(true);
  });

  it('should return true if the object has the specified key and the value is undefined.', () => {
    const key = 'a';
    const x = { [key]: undefined };
    expect(objectHasKey(x, key)).toBe(true);
  });

  it('should return false if the object does not have the specified key.', () => {
    const key = 'a';
    const x = { [key]: 1 };
    expect(objectHasKey(x, 'b')).toBe(false);
  });
});

describe('objectHasKeys()', () => {
  it('should return true if the object has all the specified keys.', () => {
    const keys = ['a', 'b'];
    const x = { a: 1, b: 2 };
    expect(objectHasKeys(x, keys)).toBe(true);
  });
});
