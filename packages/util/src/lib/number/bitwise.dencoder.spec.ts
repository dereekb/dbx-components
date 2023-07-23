import { bitwiseObjectDencoder, bitwiseSetDencoder, dencodeBitwiseSet, encodeBitwiseSet } from './bitwise.dencoder';

enum BitwiseEnumValue {
  ONE_ENABLED = 0,
  TWO_ENABLED = 1,
  THREE_ENABLED = 2
}

interface BitwiseObject {
  one?: boolean;
  two?: boolean;
  three?: boolean;
}

const TOTAL_BITWISE_ENUM_VALUE_ITEMS = 3;

describe('encodeBitwiseSet()', () => {
  it('should encode the bitwise set.', () => {
    const set = new Set([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED]);
    const result = encodeBitwiseSet(set);
    expect(result).toBe(3);
  });
});

describe('dencodeBitwiseSet()', () => {
  it('should decode the bitwise set.', () => {
    const set = new Set([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED]);
    const encoded = encodeBitwiseSet(set);
    const result = dencodeBitwiseSet(encoded);
    expect(result.size).toBe(2);
    expect(result).toContain(BitwiseEnumValue.ONE_ENABLED);
    expect(result).toContain(BitwiseEnumValue.TWO_ENABLED);
    expect(result).not.toContain(BitwiseEnumValue.THREE_ENABLED);
  });
});

describe('bitwiseSetDencoder()', () => {
  it('should encode and decode the bitwise set.', () => {
    const dencoder = bitwiseSetDencoder(TOTAL_BITWISE_ENUM_VALUE_ITEMS);
    const set = new Set([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED]);
    const encoded = dencoder(set);
    const result = dencoder(encoded);
    expect(result.size).toBe(2);
    expect(result).toContain(BitwiseEnumValue.ONE_ENABLED);
    expect(result).toContain(BitwiseEnumValue.TWO_ENABLED);
    expect(result).not.toContain(BitwiseEnumValue.THREE_ENABLED);
  });
});

describe('bitwiseObjectDencoder()', () => {
  describe('function', () => {
    const fn = bitwiseObjectDencoder<BitwiseObject, BitwiseEnumValue>({
      maxIndex: TOTAL_BITWISE_ENUM_VALUE_ITEMS,
      toSetFunction: (x) => {
        const set = new Set<BitwiseEnumValue>();

        if (x.one) {
          set.add(BitwiseEnumValue.ONE_ENABLED);
        }

        if (x.two) {
          set.add(BitwiseEnumValue.TWO_ENABLED);
        }

        if (x.three) {
          set.add(BitwiseEnumValue.THREE_ENABLED);
        }

        return set;
      },
      fromSetFunction: (x) => {
        const object: BitwiseObject = {};

        if (x.has(BitwiseEnumValue.ONE_ENABLED)) {
          object.one = true;
        }

        if (x.has(BitwiseEnumValue.TWO_ENABLED)) {
          object.two = true;
        }

        if (x.has(BitwiseEnumValue.THREE_ENABLED)) {
          object.three = true;
        }

        return object;
      }
    });

    it('should encode an object.', () => {
      const object: BitwiseObject = {
        one: true
      };

      const encoded = fn(object);

      const result = dencodeBitwiseSet(encoded);

      expect(result).toContain(BitwiseEnumValue.ONE_ENABLED);
      expect(result).not.toContain(BitwiseEnumValue.TWO_ENABLED);
      expect(result).not.toContain(BitwiseEnumValue.THREE_ENABLED);
    });

    it('should decode to an object.', () => {
      const set = new Set([BitwiseEnumValue.ONE_ENABLED]);
      const encoded = encodeBitwiseSet(set);

      const result = fn(encoded);

      expect(result.one).toBe(true);
      expect(result.two).toBeUndefined();
      expect(result.three).toBeUndefined();
    });

    it('should encode, decode, and encode an object back to the original value.', () => {
      const set = new Set([BitwiseEnumValue.ONE_ENABLED, BitwiseEnumValue.TWO_ENABLED]);
      const encoded = encodeBitwiseSet(set);
      const decoded = fn(encoded);
      const reencoded = fn(decoded);

      expect(reencoded).toBe(encoded);
    });
  });
});
