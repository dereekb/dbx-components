import { getValueFromGetter, isHex, type EncryptedString, type StringEncryptionProvider, type Getter, type GetterOrValue } from '@dereekb/util';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// MARK: Constants
/**
 * AES-256-GCM encryption constants.
 */
const ENCRYPTED_FIELD_ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_FIELD_IV_LENGTH = 12;
const ENCRYPTED_FIELD_AUTH_TAG_LENGTH = 16;
const ENCRYPTED_FIELD_KEY_LENGTH = 32;

// MARK: Types
/**
 * A hex-encoded secret key for AES-256-GCM encryption. Must be 64 hex characters (32 bytes).
 */
export type AES256GCMEncryptionSecret = string;

/**
 * Validates that the given secret is a 64-character hexadecimal string (32 bytes for AES-256).
 *
 * @param secret - the hex-encoded secret key string to validate
 * @returns true if the secret is exactly 64 valid hex characters, false otherwise
 *
 * @example
 * ```typescript
 * isValidAES256GCMEncryptionSecret('a'.repeat(64)); // true
 * isValidAES256GCMEncryptionSecret('too-short');     // false
 * ```
 */
export function isValidAES256GCMEncryptionSecret(secret: AES256GCMEncryptionSecret): boolean {
  return secret.length === ENCRYPTED_FIELD_KEY_LENGTH * 2 && isHex(secret);
}

/**
 * The source for the encryption secret.
 *
 * - If a string, it is used directly as the hex-encoded key (64 hex chars = 32 bytes).
 * - If a Getter, it is called each time to retrieve the key (useful for rotation or lazy loading).
 */
export type AES256GCMEncryptionSecretSource = GetterOrValue<AES256GCMEncryptionSecret>;

// MARK: Key Resolution
/**
 * Factory that eagerly resolves and validates the encryption key from a secret source.
 *
 * The getter is called immediately and the key is validated on creation. The returned
 * function provides the resolved Buffer without re-resolving or re-validating.
 *
 * @example
 * ```typescript
 * const getKey = resolveEncryptionKey('a'.repeat(64));
 * const key: Buffer = getKey();
 * ```
 *
 * @param source - The secret source configuration.
 * @returns A getter that returns the resolved 32-byte Buffer for AES-256 encryption.
 * @throws Error if the resolved key is not 64 hex characters.
 */
export function resolveEncryptionKey(source: AES256GCMEncryptionSecretSource): Getter<Buffer> {
  const hex: AES256GCMEncryptionSecret = getValueFromGetter(source);

  if (!isValidAES256GCMEncryptionSecret(hex)) {
    throw new Error(`resolveEncryptionKey: expected a ${ENCRYPTED_FIELD_KEY_LENGTH * 2}-character hexadecimal key, got ${hex.length} characters. Ensure the key contains only hex characters (0-9, a-f).`);
  }

  const key = Buffer.from(hex, 'hex');
  return () => key;
}

// MARK: AES256GCMEncryption
/**
 * Provides AES-256-GCM encryption/decryption for JSON-serializable values.
 *
 * The key is captured in the closure at creation time via `createAES256GCMEncryption()`.
 */
export interface AES256GCMEncryption {
  /**
   * Encrypts a raw string to a base64-encoded ciphertext string.
   *
   * Format: base64(IV (12 bytes) + ciphertext + authTag (16 bytes))
   */
  encryptString(plaintext: string): string;
  /**
   * Decrypts a base64-encoded ciphertext string back to the original plaintext.
   */
  decryptString(encoded: string): string;
  /**
   * Encrypts a JSON-serializable value to a base64-encoded string.
   *
   * The value is JSON.stringified before encryption.
   */
  encryptValue<T>(value: T): string;
  /**
   * Decrypts a base64-encoded string back to the original JSON-parsed value.
   */
  decryptValue<T>(encoded: string): T;
}

/**
 * Creates an `AES256GCMEncryption` instance that captures the resolved key in a closure.
 *
 * @example
 * ```typescript
 * const encryption = createAES256GCMEncryption('a'.repeat(64));
 *
 * const encrypted = encryption.encryptValue({ sensitive: 'data' });
 * const decrypted = encryption.decryptValue<{ sensitive: string }>(encrypted);
 *
 * const encryptedStr = encryption.encryptString('hello');
 * const decryptedStr = encryption.decryptString(encryptedStr);
 * // decryptedStr === 'hello'
 * ```
 *
 * @param source - The hex-encoded secret or getter for the AES-256 key.
 * @returns An `AES256GCMEncryption` instance.
 * @throws Error if the resolved key is not 64 hex characters.
 */
export function createAES256GCMEncryption(source: AES256GCMEncryptionSecretSource): AES256GCMEncryption {
  const getKey = resolveEncryptionKey(source);

  function encryptStringFn(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(ENCRYPTED_FIELD_IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTED_FIELD_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, encrypted, authTag]);
    return combined.toString('base64');
  }

  function decryptStringFn(encoded: string): string {
    const key = getKey();
    const combined = Buffer.from(encoded, 'base64');
    const iv = combined.subarray(0, ENCRYPTED_FIELD_IV_LENGTH);
    const authTag = combined.subarray(combined.length - ENCRYPTED_FIELD_AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(ENCRYPTED_FIELD_IV_LENGTH, combined.length - ENCRYPTED_FIELD_AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ENCRYPTED_FIELD_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  const result: AES256GCMEncryption = {
    encryptString: encryptStringFn,
    decryptString: decryptStringFn,
    encryptValue<T>(value: T): string {
      return encryptStringFn(JSON.stringify(value));
    },
    decryptValue<T>(encoded: string): T {
      return JSON.parse(decryptStringFn(encoded)) as T;
    }
  };

  return result;
}

// MARK: Standalone Functions (backwards compatibility)
/**
 * Encrypts a JSON-serializable value to a base64-encoded string using AES-256-GCM.
 *
 * Format: base64(IV (12 bytes) + ciphertext + authTag (16 bytes))
 *
 * @example
 * ```typescript
 * const getKey = resolveEncryptionKey(mySecret);
 * const encrypted = encryptValue({ sensitive: 'data' }, getKey());
 * const decrypted = decryptValue<{ sensitive: string }>(encrypted, getKey());
 * ```
 *
 * @param value - The value to encrypt (must be JSON-serializable).
 * @param key - The 32-byte encryption key from `resolveEncryptionKey()`.
 * @returns The encrypted value as a base64 string.
 */
export function encryptValue<T>(value: T, key: Buffer): string {
  const iv = randomBytes(ENCRYPTED_FIELD_IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTED_FIELD_ALGORITHM, key, iv);
  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded string back to the original value.
 *
 * @param encoded - The base64-encoded encrypted string (IV + ciphertext + authTag).
 * @param key - The 32-byte encryption key Buffer from calling the getter returned by `resolveEncryptionKey()`.
 * @returns The decrypted JSON-parsed value.
 */
export function decryptValue<T>(encoded: string, key: Buffer): T {
  const combined = Buffer.from(encoded, 'base64');
  const iv = combined.subarray(0, ENCRYPTED_FIELD_IV_LENGTH);
  const authTag = combined.subarray(combined.length - ENCRYPTED_FIELD_AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(ENCRYPTED_FIELD_IV_LENGTH, combined.length - ENCRYPTED_FIELD_AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTED_FIELD_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// MARK: StringEncryptionProvider
/**
 * Creates a `StringEncryptionProvider` backed by AES-256-GCM from a secret source.
 *
 * The key is resolved and validated eagerly at creation time. The provider encrypts/decrypts
 * raw strings (no JSON serialization) — suitable for use with `selectiveFieldEncryptor`.
 *
 * @example
 * ```typescript
 * const provider = createAesStringEncryptionProvider('a'.repeat(64));
 * const encrypted = provider.encrypt('sensitive data');
 * const decrypted = provider.decrypt(encrypted);
 * // decrypted === 'sensitive data'
 * ```
 *
 * @param source - The hex-encoded secret or getter for the AES-256 key.
 * @returns A `StringEncryptionProvider` that encrypts/decrypts strings via AES-256-GCM.
 * @throws Error if the resolved key is not 64 hex characters.
 */
export function createAesStringEncryptionProvider(source: AES256GCMEncryptionSecretSource): StringEncryptionProvider {
  const encryption = createAES256GCMEncryption(source);

  const result: StringEncryptionProvider = {
    encrypt(plaintext: string): EncryptedString {
      return encryption.encryptString(plaintext);
    },
    decrypt(ciphertext: EncryptedString): string {
      return encryption.decryptString(ciphertext);
    }
  };

  return result;
}
