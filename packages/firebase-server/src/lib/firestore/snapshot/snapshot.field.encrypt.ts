import { getValueFromGetter, type Getter, type GetterOrValue, type Maybe } from '@dereekb/util';
import { type FirestoreModelFieldMapFunctionsConfig, firestoreField, optionalFirestoreField } from '@dereekb/firebase';
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
 */
export type FirestoreEncryptedFieldSecretSource = string | Getter<string>;

/**
 * Configuration for a required encrypted Firestore field.
 *
 * @template T - The JSON-serializable value type.
 */
export interface FirestoreEncryptedFieldConfig<T> {
  /**
   * Secret source for the encryption key.
   */
  readonly secret: FirestoreEncryptedFieldSecretSource;
  /**
   * Default value when the field is missing from Firestore.
   */
  readonly default: GetterOrValue<T>;
}

/**
 * Configuration for an optional encrypted Firestore field.
 *
 * @template T - The JSON-serializable value type.
 */
export interface OptionalFirestoreEncryptedFieldConfig<T> {
  /**
   * Secret source for the encryption key.
   */
  readonly secret: FirestoreEncryptedFieldSecretSource;
}

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
  let hex: string = getValueFromGetter(source);

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

// MARK: Field Converters
/**
 * Creates a Firestore field mapping that encrypts/decrypts a JSON-serializable value
 * using AES-256-GCM. The value is stored in Firestore as a base64-encoded string.
 *
 * The encryption key is resolved from the configured secret source on each read/write,
 * allowing for key rotation via environment variable changes.
 *
 * @example
 * ```typescript
 * const jwksField = firestoreEncryptedField<JWKSet>({
 *   secret: { env: 'FIRESTORE_ENCRYPTION_KEY' },
 *   default: () => ({ keys: [] })
 * });
 * ```
 *
 * @template T - The JSON-serializable value type.
 * @param config - Encryption field configuration.
 * @returns A field mapping configuration for encrypted values.
 */
export function firestoreEncryptedField<T>(config: FirestoreEncryptedFieldConfig<T>): FirestoreModelFieldMapFunctionsConfig<T, string> {
  const { secret, default: defaultValue } = config;

  return firestoreField<T, string>({
    default: defaultValue as GetterOrValue<T>,
    fromData: (data: string) => {
      const key = resolveEncryptionKey(secret);
      return decryptValue<T>(data, key);
    },
    toData: (value: T) => {
      const key = resolveEncryptionKey(secret);
      return encryptValue(value, key);
    }
  });
}

/**
 * Creates a Firestore field mapping for an optional encrypted field.
 *
 * When the value is null/undefined, it is stored/read as null. When present, it is
 * encrypted/decrypted using AES-256-GCM.
 *
 * @example
 * ```typescript
 * const optionalSecretField = optionalFirestoreEncryptedField<OAuthClientSecret>({
 *   secret: { env: 'FIRESTORE_ENCRYPTION_KEY' }
 * });
 * ```
 *
 * @template T - The JSON-serializable value type.
 * @param config - Encryption field configuration.
 * @returns A field mapping configuration for optional encrypted values.
 */
export function optionalFirestoreEncryptedField<T>(config: OptionalFirestoreEncryptedFieldConfig<T>): FirestoreModelFieldMapFunctionsConfig<Maybe<T>, Maybe<string>> {
  const { secret } = config;

  return optionalFirestoreField<T, string>({
    transformFromData: (data: string) => {
      const key = resolveEncryptionKey(secret);
      return decryptValue<T>(data, key);
    },
    transformToData: (value: T) => {
      const key = resolveEncryptionKey(secret);
      return encryptValue(value, key);
    }
  });
}
