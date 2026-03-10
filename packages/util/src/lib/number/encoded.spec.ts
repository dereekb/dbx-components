import { encodeRadix36Number, decodeRadix36Number } from './encoded';

describe('encodeRadix36Number', () => {
  it('should encode 0 as "0"', () => {
    expect(encodeRadix36Number(0)).toBe('0');
  });

  it('should encode single digit numbers', () => {
    expect(encodeRadix36Number(9)).toBe('9');
  });

  it('should encode 10 as "a"', () => {
    expect(encodeRadix36Number(10)).toBe('a');
  });

  it('should encode 35 as "z"', () => {
    expect(encodeRadix36Number(35)).toBe('z');
  });

  it('should encode numbers larger than 35 as multi-character strings', () => {
    expect(encodeRadix36Number(36)).toBe('10');
    expect(encodeRadix36Number(100)).toBe('2s');
  });

  it('should encode large numbers', () => {
    expect(encodeRadix36Number(1000000)).toBe('lfls');
  });
});

describe('decodeRadix36Number', () => {
  it('should decode "0" as 0', () => {
    expect(decodeRadix36Number('0')).toBe(0);
  });

  it('should decode single digit strings', () => {
    expect(decodeRadix36Number('9')).toBe(9);
  });

  it('should decode "a" as 10', () => {
    expect(decodeRadix36Number('a')).toBe(10);
  });

  it('should decode "z" as 35', () => {
    expect(decodeRadix36Number('z')).toBe(35);
  });

  it('should decode multi-character strings', () => {
    expect(decodeRadix36Number('10')).toBe(36);
    expect(decodeRadix36Number('2s')).toBe(100);
  });

  it('should decode case-insensitively', () => {
    expect(decodeRadix36Number('Z')).toBe(35);
    expect(decodeRadix36Number('2S')).toBe(100);
  });

  it('should return NaN for invalid input', () => {
    expect(decodeRadix36Number('')).toBeNaN();
  });
});

describe('encodeRadix36Number and decodeRadix36Number', () => {
  it('should be reversible for non-negative integers', () => {
    const values = [0, 1, 10, 35, 36, 100, 255, 1000, 999999];

    for (const value of values) {
      const result = decodeRadix36Number(encodeRadix36Number(value));
      expect(result).toBe(value);
    }
  });
});
