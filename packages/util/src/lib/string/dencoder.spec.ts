import { expectFail, itShouldFail } from '@dereekb/util/test';
import { primativeKeyDencoder, primativeKeyDencoderMap, primativeKeyStringDencoder } from './dencoder';

enum TestEncodedValuesShort {
  TEST_A = 'a',
  TEST_B = 'b',
  TEST_C = 'c'
}

export const TEST_ENCODED_VALUES_SHORT = {
  [TestEncodedValuesShort.TEST_A]: 'testa',
  [TestEncodedValuesShort.TEST_B]: 'testb',
  [TestEncodedValuesShort.TEST_C]: 'testc'
};

enum TestEncodedValuesLong {
  TEST_A_L = 'aaa',
  TEST_B_L = 'bbb',
  TEST_C_L = 'ccc'
}

export const TEST_ENCODED_VALUES_LONG = {
  [TestEncodedValuesLong.TEST_A_L]: 'testa',
  [TestEncodedValuesLong.TEST_B_L]: 'testb',
  [TestEncodedValuesLong.TEST_C_L]: 'testc'
};

describe('primativeKeyDencoderMap()', () => {
  it('should convert the input objects map to dencoder map', () => {
    const result = primativeKeyDencoderMap(TEST_ENCODED_VALUES_SHORT);

    expect(result.has(TestEncodedValuesShort.TEST_A));
    expect(result.has('testa'));

    expect(result.has(TestEncodedValuesShort.TEST_B));
    expect(result.has('testb'));

    expect(result.has(TestEncodedValuesShort.TEST_C));
    expect(result.has('testc'));
  });

  itShouldFail('if a key or value has the same value as another key or value.', () => {
    expectFail(() =>
      primativeKeyDencoderMap({
        a: 'b',
        b: 'c'
      })
    );
  });
});

describe('primativeKeyDencoder()', () => {
  describe('function', () => {
    const fn = primativeKeyDencoder({ values: TEST_ENCODED_VALUES_SHORT });

    itShouldFail('if an unknown key or value is input alone', () => {
      expectFail(() => fn('unknown_Value'));
    });

    it('should skip any unknown inputs for arrays', () => {
      const result = fn(['unknown_value']);
      expect(result.length).toBe(0);
    });

    it('should convert the values', () => {
      expect(fn('testa')).toBe(TestEncodedValuesShort.TEST_A);
      expect(fn('testb')).toBe(TestEncodedValuesShort.TEST_B);
      expect(fn('testc')).toBe(TestEncodedValuesShort.TEST_C);
    });

    it('should convert the keys', () => {
      expect(fn(TestEncodedValuesShort.TEST_A)).toBe('testa');
      expect(fn(TestEncodedValuesShort.TEST_B)).toBe('testb');
      expect(fn(TestEncodedValuesShort.TEST_C)).toBe('testc');
    });

    it('should convert the array of values', () => {
      expect(fn(['testa'])[0]).toBe(TestEncodedValuesShort.TEST_A);
      expect(fn(['testb'])[0]).toBe(TestEncodedValuesShort.TEST_B);
      expect(fn(['testc'])[0]).toBe(TestEncodedValuesShort.TEST_C);
    });

    it('should convert the array of values', () => {
      const result = fn(['testa', 'testb']);
      expect(result.length).toBe(2);
      expect(result).toContain(TestEncodedValuesShort.TEST_A);
      expect(result).toContain(TestEncodedValuesShort.TEST_B);
    });
  });
});

describe('primativeKeyStringDencoder()', () => {
  describe('no splitter', () => {
    itShouldFail('if any keys have more than 1 character', () => {
      expectFail(() => primativeKeyStringDencoder({ dencoder: { values: TEST_ENCODED_VALUES_LONG } }));
    });

    describe('function', () => {
      const fn = primativeKeyStringDencoder({ dencoder: { values: TEST_ENCODED_VALUES_SHORT } });

      it('should convert the encoded values string to an array of decoded values.', () => {
        const result = fn(TestEncodedValuesShort.TEST_A);

        expect(result.length).toBe(1);
        expect(result[0]).toBe('testa');
      });

      it('should convert the input keys to an encoded array.', () => {
        expect(Array.isArray(fn(TestEncodedValuesShort.TEST_A)));
        expect(fn(TestEncodedValuesShort.TEST_A)[0]).toBe('testa');
        expect(fn(TestEncodedValuesShort.TEST_B)[0]).toBe('testb');
        expect(fn(TestEncodedValuesShort.TEST_C)[0]).toBe('testc');
      });

      it('should encode the input values', () => {
        const input = ['testa', 'testb'];

        const result = fn(input);
        expect(result).toBe(`${TestEncodedValuesShort.TEST_A}${TestEncodedValuesShort.TEST_B}`);
      });

      it('should encode and decode the input values', () => {
        const input = ['testa', 'testb'];

        const encoded = fn(input);
        const decoded = fn(encoded);

        expect(decoded).toContain(input[0]);
        expect(decoded).toContain(input[1]);
      });
    });
  });

  describe('splitter', () => {
    it('should create a function even if the values contain the splitter.', () => {
      const result = primativeKeyStringDencoder({ dencoder: { values: TEST_ENCODED_VALUES_SHORT }, splitter: 'test' });
      expect(result).toBeDefined();
    });

    itShouldFail('if any keys contain the splitter', () => {
      expectFail(() => primativeKeyStringDencoder({ dencoder: { values: TEST_ENCODED_VALUES_LONG }, splitter: 'a' }));
    });

    describe('function', () => {
      const splitter = '_';
      const fn = primativeKeyStringDencoder({ dencoder: { values: TEST_ENCODED_VALUES_LONG }, splitter });

      it('should convert the encoded values separated by splitter to an array of decoded values.', () => {
        const result = fn(`${TestEncodedValuesLong.TEST_A_L}${splitter}${TestEncodedValuesLong.TEST_B_L}`);

        expect(result.length).toBe(2);
        expect(result[0]).toBe('testa');
        expect(result[1]).toBe('testb');
      });

      it('should encode the input values', () => {
        const input = ['testa', 'testb'];

        const result = fn(input);
        expect(result).toBe(`${TestEncodedValuesLong.TEST_A_L}${splitter}${TestEncodedValuesLong.TEST_B_L}`);
      });

      it('should encode and decode the input values', () => {
        const input = ['testa', 'testb'];

        const encoded = fn(input);
        const decoded = fn(encoded);

        expect(decoded).toContain(input[0]);
        expect(decoded).toContain(input[1]);
      });
    });
  });
});
