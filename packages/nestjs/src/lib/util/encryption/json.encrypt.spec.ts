import { randomBytes } from 'crypto';
import { selectiveFieldEncryptor } from '@dereekb/util';
import { isValidAES256GCMEncryptionSecret, resolveEncryptionKey, encryptValue, decryptValue, createAES256GCMEncryption, createAesStringEncryptionProvider } from './json.encrypt';

function testEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

describe('isValidAES256GCMEncryptionSecret()', () => {
  it('should return true for a valid 64-character hex string', () => {
    expect(isValidAES256GCMEncryptionSecret('a'.repeat(64))).toBe(true);
  });

  it('should return false for a short string', () => {
    expect(isValidAES256GCMEncryptionSecret('too-short')).toBe(false);
  });

  it('should return false for a 64-character non-hex string', () => {
    expect(isValidAES256GCMEncryptionSecret('z'.repeat(64))).toBe(false);
  });
});

describe('resolveEncryptionKey()', () => {
  it('should resolve a valid hex string to a Buffer getter', () => {
    const secret = testEncryptionKey();
    const getKey = resolveEncryptionKey(secret);
    const key = getKey();

    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it('should accept a getter function', () => {
    const secret = testEncryptionKey();
    const getKey = resolveEncryptionKey(() => secret);

    expect(getKey().length).toBe(32);
  });

  it('should throw for an invalid key', () => {
    expect(() => resolveEncryptionKey('tooshort')).toThrow('64-character hex');
  });
});

describe('encryptValue() / decryptValue()', () => {
  const secret = testEncryptionKey();
  const getKey = resolveEncryptionKey(secret);

  it('should round-trip a string value', () => {
    const encrypted = encryptValue('hello', getKey());
    const decrypted = decryptValue<string>(encrypted, getKey());

    expect(decrypted).toBe('hello');
  });

  it('should round-trip an object value', () => {
    const original = { name: 'test', items: [1, 2, 3] };
    const encrypted = encryptValue(original, getKey());
    const decrypted = decryptValue<typeof original>(encrypted, getKey());

    expect(decrypted).toEqual(original);
  });

  it('should produce different ciphertext on each call due to random IV', () => {
    const encrypted1 = encryptValue('same', getKey());
    const encrypted2 = encryptValue('same', getKey());

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should fail to decrypt with a different key', () => {
    const otherKey = resolveEncryptionKey(testEncryptionKey());
    const encrypted = encryptValue('secret', getKey());

    expect(() => decryptValue(encrypted, otherKey())).toThrow();
  });
});

describe('createAES256GCMEncryption()', () => {
  const secret = testEncryptionKey();

  describe('encryptString() / decryptString()', () => {
    const encryption = createAES256GCMEncryption(secret);

    it('should round-trip a plain string', () => {
      const encrypted = encryption.encryptString('hello world');
      const decrypted = encryption.decryptString(encrypted);

      expect(decrypted).toBe('hello world');
    });

    it('should produce different ciphertext on each call', () => {
      const a = encryption.encryptString('same');
      const b = encryption.encryptString('same');

      expect(a).not.toBe(b);
    });
  });

  describe('encryptValue() / decryptValue()', () => {
    const encryption = createAES256GCMEncryption(secret);

    it('should round-trip a JSON-serializable value', () => {
      const original = { key: 'value', nested: { items: [1, 2] } };
      const encrypted = encryption.encryptValue(original);
      const decrypted = encryption.decryptValue<typeof original>(encrypted);

      expect(decrypted).toEqual(original);
    });

    it('should round-trip a number value', () => {
      const encrypted = encryption.encryptValue(42);
      const decrypted = encryption.decryptValue<number>(encrypted);

      expect(decrypted).toBe(42);
    });
  });

  it('should fail to decrypt with a different key', () => {
    const encryption1 = createAES256GCMEncryption(secret);
    const encryption2 = createAES256GCMEncryption(testEncryptionKey());

    const encrypted = encryption1.encryptString('secret');

    expect(() => encryption2.decryptString(encrypted)).toThrow();
  });
});

describe('createAesStringEncryptionProvider()', () => {
  const secret = testEncryptionKey();
  const provider = createAesStringEncryptionProvider(secret);

  it('should round-trip a string', () => {
    const encrypted = provider.encrypt('hello');
    const decrypted = provider.decrypt(encrypted);

    expect(decrypted).toBe('hello');
  });

  it('should produce opaque ciphertext that does not contain the plaintext', () => {
    const encrypted = provider.encrypt('sensitive');

    expect(encrypted).not.toContain('sensitive');
  });

  describe('with selectiveFieldEncryptor', () => {
    interface TestClient {
      client_id: string;
      client_secret: string;
      client_name: string;
    }

    const encryptor = selectiveFieldEncryptor<TestClient, 'client_secret'>({
      provider,
      fields: ['client_secret']
    });

    it('should round-trip encrypt and decrypt via selective field encryption', () => {
      const input: TestClient = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
      const encrypted = encryptor.encrypt(input);
      const decrypted = encryptor.decrypt(encrypted);

      expect(decrypted).toEqual(input);
    });

    it('should produce an opaque encrypted field value', () => {
      const input: TestClient = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
      const encrypted = encryptor.encrypt(input);

      expect(encrypted).toHaveProperty('$client_secret');
      expect((encrypted as Record<string, unknown>)['$client_secret']).not.toContain('s3cret');
    });
  });
});
