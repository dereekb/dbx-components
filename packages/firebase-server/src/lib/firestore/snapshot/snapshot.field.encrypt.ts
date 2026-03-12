import { type GetterOrValue, type Maybe } from '@dereekb/util';
import { type FirestoreModelFieldMapFunctionsConfig, firestoreField, optionalFirestoreField } from '@dereekb/firebase';
import { resolveEncryptionKey, encryptValue, decryptValue } from '@dereekb/nestjs';

// MARK: Types
/**
 * Configuration for a required encrypted Firestore field.
 *
 * @template T - The JSON-serializable value type.
 */
export interface FirestoreEncryptedFieldConfig<T> {
  /**
   * Secret source for the encryption key.
   */
  readonly secret: GetterOrValue<string>;
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
  readonly secret: GetterOrValue<string>;
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
 *   secret: process.env['FIRESTORE_ENCRYPTION_KEY']!,
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
  const getKey = resolveEncryptionKey(secret);

  return firestoreField<T, string>({
    default: defaultValue as GetterOrValue<T>,
    fromData: (data: string) => {
      return decryptValue<T>(data, getKey());
    },
    toData: (value: T) => {
      return encryptValue(value, getKey());
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
 *   secret: process.env['FIRESTORE_ENCRYPTION_KEY']!
 * });
 * ```
 *
 * @template T - The JSON-serializable value type.
 * @param config - Encryption field configuration.
 * @returns A field mapping configuration for optional encrypted values.
 */
export function optionalFirestoreEncryptedField<T>(config: OptionalFirestoreEncryptedFieldConfig<T>): FirestoreModelFieldMapFunctionsConfig<Maybe<T>, Maybe<string>> {
  const { secret } = config;
  const getKey = resolveEncryptionKey(secret);

  return optionalFirestoreField<T, string>({
    transformFromData: (data: string) => {
      return decryptValue<T>(data, getKey());
    },
    transformToData: (value: T) => {
      return encryptValue(value, getKey());
    }
  });
}
