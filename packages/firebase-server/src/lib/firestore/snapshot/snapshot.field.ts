import { type Maybe, type GetterOrValue } from '@dereekb/util';
import { type FirestoreModelFieldMapFunctionsConfig, firestoreField, optionalFirestoreField } from '@dereekb/firebase';
import { type FirestoreEncryptedFieldSecretSource, type FirestoreEncryptedFieldConfig, type OptionalFirestoreEncryptedFieldConfig, resolveEncryptionKey, encryptValue, decryptValue } from './snapshot.encrypt';

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
