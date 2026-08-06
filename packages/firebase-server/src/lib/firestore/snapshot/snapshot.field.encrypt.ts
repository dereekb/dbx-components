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
  /**
   * Called when a stored value is present but cannot be decrypted — a wrong or rotated key, a
   * corrupt value, or data written before the field was encrypted. Its return value is used in
   * place of the decrypted value.
   *
   * When omitted the decode throws, which is the correct behavior for a field of record: a
   * credential that silently becomes `undefined` is far worse than a loud failure.
   *
   * Only supply this for data that can be regenerated — a cache. See the Zoho access token cache,
   * where an undecryptable entry is a cache miss and the next call re-mints the token.
   */
  readonly onDecodeFailure?: Maybe<(error: unknown, data: string) => T>;
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
  /**
   * Called when a stored value is present but cannot be decrypted. See
   * {@link FirestoreEncryptedFieldConfig.onDecodeFailure}. When omitted the decode throws.
   */
  readonly onDecodeFailure?: Maybe<(error: unknown, data: string) => Maybe<T>>;
}

// MARK: Field Converters
/**
 * Creates a Firestore field mapping that encrypts/decrypts a JSON-serializable value
 * using AES-256-GCM. The value is stored in Firestore as a base64-encoded string.
 *
 * IMPORTANT: there is NO key rotation. `resolveEncryptionKey()` reads and validates the secret once,
 * here at construction, and closes over the resulting key — changing the secret afterwards orphans
 * every value already written with the old one. Rotation is only survivable for fields that supply
 * {@link FirestoreEncryptedFieldConfig.onDecodeFailure} and hold regenerable data.
 *
 * @param config - Encryption field configuration.
 * @returns A field mapping configuration for encrypted values.
 *
 * @template T - The JSON-serializable value type.
 *
 * @example
 * ```typescript
 * const jwksField = firestoreEncryptedField<JWKSet>({
 *   secret: process.env['FIRESTORE_ENCRYPTION_KEY']!,
 *   default: () => ({ keys: [] })
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function firestoreEncryptedField<T>(config: FirestoreEncryptedFieldConfig<T>): FirestoreModelFieldMapFunctionsConfig<T, string> {
  const { secret, default: defaultValue, onDecodeFailure } = config;
  const getKey = resolveEncryptionKey(secret);

  return firestoreField<T, string>({
    default: defaultValue,
    fromData: (data: string) => {
      let result: T;

      if (onDecodeFailure == null) {
        result = decryptValue<T>(data, getKey());
      } else {
        try {
          result = decryptValue<T>(data, getKey());
        } catch (e) {
          result = onDecodeFailure(e, data);
        }
      }

      return result;
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
 * @param config - Encryption field configuration.
 * @returns A field mapping configuration for optional encrypted values.
 *
 * @template T - The JSON-serializable value type.
 *
 * @example
 * ```typescript
 * const optionalSecretField = optionalFirestoreEncryptedField<OAuthClientSecret>({
 *   secret: process.env['FIRESTORE_ENCRYPTION_KEY']!
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function optionalFirestoreEncryptedField<T>(config: OptionalFirestoreEncryptedFieldConfig<T>): FirestoreModelFieldMapFunctionsConfig<Maybe<T>, Maybe<string>> {
  const { secret, onDecodeFailure } = config;
  const getKey = resolveEncryptionKey(secret);

  return optionalFirestoreField<T, string>({
    transformFromData: (data: string) => {
      let result: Maybe<T>;

      if (onDecodeFailure == null) {
        result = decryptValue<T>(data, getKey());
      } else {
        try {
          result = decryptValue<T>(data, getKey());
        } catch (e) {
          result = onDecodeFailure(e, data);
        }
      }

      return result as T;
    },
    transformToData: (value: T) => {
      return encryptValue(value, getKey());
    }
  });
}
