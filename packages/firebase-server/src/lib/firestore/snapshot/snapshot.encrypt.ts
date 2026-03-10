import { type Getter } from '@dereekb/util';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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
 * The source for the encryption secret.
 *
 * - If a string, it is used directly as the hex-encoded key (64 hex chars = 32 bytes).
 * - If a Getter, it is called each time to retrieve the key (useful for rotation or lazy loading).
 * - If an object with `env`, the key is read from the specified environment variable.
 */
export type FirestoreEncryptedFieldSecretSource = string | Getter<string> | { env: string };

// MARK: Functions
/**
 * Resolves the encryption key Buffer from a secret source.
 *
 * @example
 * ```typescript
 * const key = resolveEncryptionKey('a'.repeat(64));
 * const key2 = resolveEncryptionKey({ env: 'MY_SECRET' });
 * const key3 = resolveEncryptionKey(() => getSecretFromVault());
 * ```
 *
 * @param source - The secret source configuration.
 * @returns A 32-byte Buffer for AES-256 encryption.
 * @throws Error if the resolved key is not 64 hex characters.
 */
export function resolveEncryptionKey(source: FirestoreEncryptedFieldSecretSource): Buffer {
  let hex: string;

  if (typeof source === 'string') {
    hex = source;
  } else if (typeof source === 'function') {
    hex = source();
  } else {
    const envValue = process.env[source.env];

    if (!envValue) {
      throw new Error(`firestoreEncryptedField: environment variable "${source.env}" is not set.`);
    }

    hex = envValue;
  }

  if (hex.length !== ENCRYPTED_FIELD_KEY_LENGTH * 2) {
    throw new Error(`firestoreEncryptedField: expected a ${ENCRYPTED_FIELD_KEY_LENGTH * 2}-character hex key, got ${hex.length} characters.`);
  }

  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a JSON-serializable value to a base64-encoded string using AES-256-GCM.
 *
 * Format: base64(IV (12 bytes) + ciphertext + authTag (16 bytes))
 *
 * @example
 * ```typescript
 * const key = resolveEncryptionKey(mySecret);
 * const encrypted = encryptValue({ sensitive: 'data' }, key);
 * const decrypted = decryptValue<{ sensitive: string }>(encrypted, key);
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
 * @param key - The 32-byte encryption key from `resolveEncryptionKey()`.
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
