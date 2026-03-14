import { encodeRadix36Number, decodeRadix36Number, isHex } from './encoded';

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

describe('isHex', () => {
  it('should return true for lowercase hex strings', () => {
    expect(isHex('0123456789abcdef')).toBe(true);
  });

  it('should return true for uppercase hex strings', () => {
    expect(isHex('0123456789ABCDEF')).toBe(true);
  });

  it('should return true for mixed case hex strings', () => {
    expect(isHex('a1B2c3D4')).toBe(true);
  });

  it('should return false for empty strings', () => {
    expect(isHex('')).toBe(false);
  });

  it('should return false for strings with non-hex characters', () => {
    expect(isHex('xyz')).toBe(false);
    expect(isHex('thequickbrownfox')).toBe(false);
    expect(isHex('0x1a')).toBe(false);
  });

  it('should return false for strings with spaces', () => {
    expect(isHex('ab cd')).toBe(false);
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
