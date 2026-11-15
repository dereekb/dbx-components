import { describe, expect, it } from 'vitest';
import { deriveAES256GCMEncryptionSecret } from './encryption.derive';
import { createAES256GCMEncryption, isValidAES256GCMEncryptionSecret } from './json.encrypt';

const PARENT_SECRET = '0123456789abcdef'.repeat(4);

describe('deriveAES256GCMEncryptionSecret()', () => {
  it('should return a valid AES-256-GCM secret', () => {
    const result = deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v1' });
    expect(isValidAES256GCMEncryptionSecret(result)).toBe(true);
  });

  it('should be deterministic', () => {
    const a = deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v1' });
    const b = deriveAES256GCMEncryptionSecret({ secret: () => PARENT_SECRET, info: 'test/v1' });
    expect(a).toBe(b);
  });

  it('should differ from the parent secret', () => {
    const result = deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v1' });
    expect(result).not.toBe(PARENT_SECRET);
  });

  it('should produce a different key for a different info label', () => {
    const a = deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v1' });
    const b = deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v2' });
    expect(a).not.toBe(b);
  });

  it('should produce a key that cannot decrypt the parent key ciphertext', () => {
    const parent = createAES256GCMEncryption(PARENT_SECRET);
    const derived = createAES256GCMEncryption(deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: 'test/v1' }));
    const encrypted = parent.encryptValue({ secret: 'value' });
    expect(() => derived.decryptValue(encrypted)).toThrow();
  });

  it('should throw for an invalid parent secret', () => {
    expect(() => deriveAES256GCMEncryptionSecret({ secret: 'not-hex', info: 'test/v1' })).toThrow();
  });

  it('should throw for an empty info label', () => {
    expect(() => deriveAES256GCMEncryptionSecret({ secret: PARENT_SECRET, info: '' })).toThrow();
  });
});
