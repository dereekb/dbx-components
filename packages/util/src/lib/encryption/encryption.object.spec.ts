import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { type StringEncryptionProvider, selectiveFieldEncryptor } from './encryption.object';

/**
 * Simple mock encryption provider that wraps/unwraps values with a marker for testing.
 */
function mockEncryptionProvider(): StringEncryptionProvider {
  return {
    encrypt: (plaintext: string) => `__${plaintext}__`,
    decrypt: (ciphertext: string) => {
      if (!ciphertext.startsWith('__') || !ciphertext.endsWith('__')) {
        throw new Error('Expected encrypted value to be wrapped with "__"');
      }

      return ciphertext.slice(2, -2);
    }
  };
}

/**
 * AES-256-GCM encryption provider for realistic round-trip testing.
 */
function aesEncryptionProvider(): StringEncryptionProvider {
  const key = randomBytes(32);

  return {
    encrypt: (plaintext: string) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const combined = Buffer.concat([iv, encrypted, authTag]);
      return combined.toString('base64');
    },
    decrypt: (ciphertext: string) => {
      const combined = Buffer.from(ciphertext, 'base64');
      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(combined.length - 16);
      const encrypted = combined.subarray(12, combined.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    }
  };
}

interface TestObject {
  client_id: string;
  client_secret: string;
  client_name: string;
  metadata?: { nested: boolean };
}

describe('selectiveFieldEncryptor()', () => {
  describe('with mock provider', () => {
    const provider = mockEncryptionProvider();

    describe('with single field', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret'>({
        provider,
        fields: ['client_secret']
      });

      it('should encrypt the specified field and prefix the key', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'My App' };
        const encrypted = encryptor.encrypt(input);

        expect(encrypted).toHaveProperty('$client_secret');
        expect(encrypted).not.toHaveProperty('client_secret');
        expect(encrypted.client_id).toBe('abc');
        expect(encrypted.client_name).toBe('My App');
      });

      it('should round-trip encrypt then decrypt back to the original', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'My App' };
        const encrypted = encryptor.encrypt(input);
        const decrypted = encryptor.decrypt(encrypted);

        expect(decrypted).toEqual(input);
      });
    });

    describe('with multiple fields', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret' | 'client_name'>({
        provider,
        fields: ['client_secret', 'client_name']
      });

      it('should encrypt all specified fields', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'My App' };
        const encrypted = encryptor.encrypt(input);

        expect(encrypted).toHaveProperty('$client_secret');
        expect(encrypted).toHaveProperty('$client_name');
        expect(encrypted).not.toHaveProperty('client_secret');
        expect(encrypted).not.toHaveProperty('client_name');
        expect(encrypted.client_id).toBe('abc');
      });

      it('should round-trip encrypt then decrypt back to the original', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'My App' };
        const encrypted = encryptor.encrypt(input);
        const decrypted = encryptor.decrypt(encrypted);

        expect(decrypted).toEqual(input);
      });
    });

    describe('non-encrypted fields', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret'>({
        provider,
        fields: ['client_secret']
      });

      it('should pass non-encrypted fields through unchanged', () => {
        const input: TestObject = { client_id: 'id-123', client_secret: 'secret', client_name: 'Test App' };
        const encrypted = encryptor.encrypt(input);

        expect(encrypted.client_id).toBe('id-123');
        expect(encrypted.client_name).toBe('Test App');
      });
    });

    describe('missing optional fields', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret' | 'metadata'>({
        provider,
        fields: ['client_secret', 'metadata']
      });

      it('should skip missing fields during encryption', () => {
        const input = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' } as TestObject;
        const encrypted = encryptor.encrypt(input);

        expect(encrypted).toHaveProperty('$client_secret');
        expect(encrypted).not.toHaveProperty('$metadata');
        expect(encrypted).not.toHaveProperty('metadata');
      });

      it('should skip missing prefixed fields during decryption', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
        const encrypted = encryptor.encrypt(input);
        const decrypted = encryptor.decrypt(encrypted);

        expect(decrypted.metadata).toBeUndefined();
        expect(decrypted.client_secret).toBe('s3cret');
      });
    });

    describe('complex field values', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'metadata'>({
        provider,
        fields: ['metadata']
      });

      it('should handle nested objects via JSON serialization', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 'sec', client_name: 'App', metadata: { nested: true } };
        const encrypted = encryptor.encrypt(input);
        const decrypted = encryptor.decrypt(encrypted);

        expect(decrypted.metadata).toEqual({ nested: true });
      });
    });

    describe('custom prefix', () => {
      const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret'>({
        provider,
        fields: ['client_secret'],
        prefix: 'enc_'
      });

      it('should use the custom prefix for encrypted field keys', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
        const encrypted = encryptor.encrypt(input);

        expect(encrypted).toHaveProperty('enc_client_secret');
        expect(encrypted).not.toHaveProperty('$client_secret');
        expect(encrypted).not.toHaveProperty('client_secret');
      });

      it('should round-trip with custom prefix', () => {
        const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
        const encrypted = encryptor.encrypt(input);
        const decrypted = encryptor.decrypt(encrypted);

        expect(decrypted).toEqual(input);
      });
    });
  });

  describe('with AES-256-GCM provider', () => {
    const provider = aesEncryptionProvider();

    const encryptor = selectiveFieldEncryptor<TestObject, 'client_secret'>({
      provider,
      fields: ['client_secret']
    });

    it('should produce an opaque encrypted value for the field', () => {
      const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
      const encrypted = encryptor.encrypt(input);

      expect(encrypted).toHaveProperty('$client_secret');
      expect((encrypted as Record<string, unknown>)['$client_secret']).not.toBe('s3cret');
      expect((encrypted as Record<string, unknown>)['$client_secret']).not.toContain('s3cret');
    });

    it('should round-trip encrypt then decrypt back to the original', () => {
      const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'My App' };
      const encrypted = encryptor.encrypt(input);
      const decrypted = encryptor.decrypt(encrypted);

      expect(decrypted).toEqual(input);
    });

    it('should round-trip with nested object fields', () => {
      const metadataEncryptor = selectiveFieldEncryptor<TestObject, 'metadata'>({
        provider,
        fields: ['metadata']
      });

      const input: TestObject = { client_id: 'abc', client_secret: 'sec', client_name: 'App', metadata: { nested: true } };
      const encrypted = metadataEncryptor.encrypt(input);
      const decrypted = metadataEncryptor.decrypt(encrypted);

      expect(decrypted).toEqual(input);
    });

    it('should produce different ciphertext on each encryption', () => {
      const input: TestObject = { client_id: 'abc', client_secret: 's3cret', client_name: 'App' };
      const encrypted1 = encryptor.encrypt(input);
      const encrypted2 = encryptor.encrypt(input);

      expect((encrypted1 as Record<string, unknown>)['$client_secret']).not.toBe((encrypted2 as Record<string, unknown>)['$client_secret']);
    });
  });
});
