import { modelFieldMapFunctions } from '@dereekb/util';
import { firestoreEncryptedField, optionalFirestoreEncryptedField } from './snapshot.field';
import { randomBytes } from 'crypto';

// generate a random 32-byte hex key for tests
function testEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

describe('firestoreEncryptedField()', () => {
  const secret = testEncryptionKey();

  interface TestData {
    name: string;
    value: number;
    nested: { items: string[] };
  }

  const testValue: TestData = {
    name: 'test',
    value: 42,
    nested: { items: ['a', 'b', 'c'] }
  };

  const defaultValue: TestData = {
    name: '',
    value: 0,
    nested: { items: [] }
  };

  describe('conversion', () => {
    const field = firestoreEncryptedField<TestData>({
      secret,
      default: () => ({ ...defaultValue })
    });

    const { from, to } = modelFieldMapFunctions(field);

    describe('to (encrypt)', () => {
      it('should encrypt the value to a base64 string', () => {
        const encrypted = to(testValue);
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBe('');

        // should be valid base64
        const decoded = Buffer.from(encrypted as string, 'base64');
        expect(decoded.length).toBeGreaterThan(0);
      });

      it('should produce different ciphertext on each call (random IV)', () => {
        const encrypted1 = to(testValue);
        const encrypted2 = to(testValue);
        expect(encrypted1).not.toBe(encrypted2);
      });
    });

    describe('from (decrypt)', () => {
      it('should return the default value when null/undefined is provided', () => {
        const result = from(null);
        expect(result).toEqual(defaultValue);
      });

      it('should decrypt back to the original value', () => {
        const encrypted = to(testValue);
        const decrypted = from(encrypted);
        expect(decrypted).toEqual(testValue);
      });
    });

    describe('round-trip', () => {
      it('should round-trip a string value', () => {
        const stringField = firestoreEncryptedField<string>({ secret, default: '' });
        const fns = modelFieldMapFunctions(stringField);
        const original = 'hello world';
        expect(fns.from(fns.to(original))).toBe(original);
      });

      it('should round-trip a number value', () => {
        const numberField = firestoreEncryptedField<number>({ secret, default: 0 });
        const fns = modelFieldMapFunctions(numberField);
        expect(fns.from(fns.to(12345))).toBe(12345);
      });

      it('should round-trip an array value', () => {
        const arrayField = firestoreEncryptedField<number[]>({ secret, default: () => [] });
        const fns = modelFieldMapFunctions(arrayField);
        const original = [1, 2, 3];
        expect(fns.from(fns.to(original))).toEqual(original);
      });

      it('should round-trip a complex object', () => {
        const encrypted = to(testValue);
        const decrypted = from(encrypted);
        expect(decrypted).toEqual(testValue);
      });
    });
  });

  describe('secret sources', () => {
    it('should accept a direct hex string', () => {
      const field = firestoreEncryptedField<string>({ secret, default: '' });
      const fns = modelFieldMapFunctions(field);
      expect(fns.from(fns.to('test'))).toBe('test');
    });

    it('should accept a getter function', () => {
      const field = firestoreEncryptedField<string>({ secret: () => secret, default: '' });
      const fns = modelFieldMapFunctions(field);
      expect(fns.from(fns.to('test'))).toBe('test');
    });

    it('should accept an env source', () => {
      const envKey = 'TEST_ENCRYPTED_FIELD_KEY';
      process.env[envKey] = secret;

      try {
        const field = firestoreEncryptedField<string>({ secret: { env: envKey }, default: '' });
        const fns = modelFieldMapFunctions(field);
        expect(fns.from(fns.to('test'))).toBe('test');
      } finally {
        delete process.env[envKey];
      }
    });

    it('should throw if env variable is not set', () => {
      const field = firestoreEncryptedField<string>({ secret: { env: 'NONEXISTENT_KEY' }, default: '' });
      const fns = modelFieldMapFunctions(field);
      expect(() => fns.to('test')).toThrow('environment variable');
    });

    it('should throw if key is wrong length', () => {
      const field = firestoreEncryptedField<string>({ secret: 'tooshort', default: '' });
      const fns = modelFieldMapFunctions(field);
      expect(() => fns.to('test')).toThrow('64-character hex key');
    });
  });

  describe('wrong key', () => {
    it('should fail to decrypt with a different key', () => {
      const key1 = testEncryptionKey();
      const key2 = testEncryptionKey();

      const field1 = firestoreEncryptedField<string>({ secret: key1, default: '' });
      const field2 = firestoreEncryptedField<string>({ secret: key2, default: '' });

      const fns1 = modelFieldMapFunctions(field1);
      const fns2 = modelFieldMapFunctions(field2);

      const encrypted = fns1.to('secret data');
      expect(() => fns2.from(encrypted)).toThrow();
    });
  });
});

describe('optionalFirestoreEncryptedField()', () => {
  const secret = testEncryptionKey();

  describe('conversion', () => {
    const field = optionalFirestoreEncryptedField<{ key: string }>({ secret });
    const { from, to } = modelFieldMapFunctions(field);

    it('should return undefined when null is provided', () => {
      expect(from(null)).toBeUndefined();
      expect(from(undefined)).toBeUndefined();
    });

    it('should pass through null on write', () => {
      expect(to(null)).toBeNull();
      expect(to(undefined)).toBeNull();
    });

    it('should encrypt and decrypt a value', () => {
      const original = { key: 'value' };
      const encrypted = to(original);
      expect(typeof encrypted).toBe('string');

      const decrypted = from(encrypted);
      expect(decrypted).toEqual(original);
    });
  });
});
