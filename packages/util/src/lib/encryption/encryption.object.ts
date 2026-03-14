import { type Maybe } from '../value/maybe.type';

// MARK: Branded Types
/**
 * Branded type representing a string that has been encrypted.
 *
 * Use this type to distinguish encrypted ciphertext from plain strings at the type level.
 * The actual encryption algorithm is determined by the {@link StringEncryptionProvider}.
 */
export type EncryptedString = string;

// MARK: Types
/**
 * Encrypts a plaintext string to an encrypted string.
 */
export type EncryptStringFunction = (plaintext: string) => EncryptedString;

/**
 * Decrypts an encrypted string back to plaintext.
 */
export type DecryptStringFunction = (ciphertext: EncryptedString) => string;

/**
 * Provider that can encrypt and decrypt strings.
 *
 * Implementations wrap a specific algorithm (e.g. AES-256-GCM) and key management
 * behind a simple encrypt/decrypt interface for use with selective field encryption.
 */
export interface StringEncryptionProvider {
  readonly encrypt: EncryptStringFunction;
  readonly decrypt: DecryptStringFunction;
}

/**
 * Configuration for selective object field encryption.
 *
 * @template T - The object type being encrypted.
 * @template F - The union of field names to encrypt.
 */
export interface SelectiveFieldEncryptionConfig<T, F extends keyof T> {
  /**
   * The encryption provider for string encrypt/decrypt.
   */
  readonly provider: StringEncryptionProvider;
  /**
   * Fields to encrypt/decrypt.
   */
  readonly fields: F[];
  /**
   * Prefix marker for encrypted fields.
   *
   * @defaultValue '$'
   */
  readonly prefix?: string;
}

// MARK: Mapped Types
/**
 * Default prefix used for encrypted field names.
 */
export const DEFAULT_ENCRYPTED_FIELD_PREFIX = '$';

/**
 * Maps an object type so that specified fields are removed and replaced with
 * prefixed encrypted string fields.
 *
 * Given `{ a: number; b: string; c: boolean }` with fields `['a', 'b']` and prefix `'$'`,
 * produces `{ $a: EncryptedString; $b: EncryptedString; c: boolean }`.
 *
 * @template T - The original object type.
 * @template F - Union of field names to encrypt.
 * @template Prefix - The string prefix for encrypted field names.
 */
export type SelectivelyEncryptedObject<T, F extends keyof T, Prefix extends string = '$'> = Omit<T, F> & {
  [K in F as `${Prefix}${string & K}`]: EncryptedString;
};

/**
 * Instance that can encrypt/decrypt specific fields on an object.
 *
 * @template T - The original object type.
 * @template F - Union of field names to encrypt.
 */
export interface SelectiveFieldEncryptor<T, F extends keyof T> {
  /**
   * Encrypts specified fields, producing an object with prefixed encrypted keys.
   *
   * Original field keys are removed and replaced with `${prefix}${fieldName}` keys
   * whose values are encrypted strings.
   */
  encrypt(input: T): SelectivelyEncryptedObject<T, F>;
  /**
   * Decrypts prefixed encrypted keys back to the original field names and values.
   *
   * Prefixed keys are removed and replaced with the original field keys. If a prefixed
   * key is missing, the field is skipped (it wasn't present in the original).
   */
  decrypt(input: SelectivelyEncryptedObject<T, F>): T;
}

// MARK: Factory
/**
 * Creates a selective field encryptor that encrypts/decrypts specific fields on an object.
 *
 * Each encrypted field's value is JSON.stringified before encryption and JSON.parsed after
 * decryption, so fields can hold any JSON-serializable value (not just strings).
 *
 * @example
 * ```ts
 * const encryptor = selectiveFieldEncryptor({
 *   provider: myEncryptionProvider,
 *   fields: ['client_secret'] as const
 * });
 *
 * const encrypted = encryptor.encrypt({ client_id: 'abc', client_secret: 's3cret' });
 * // encrypted => { client_id: 'abc', $client_secret: '<ciphertext>' }
 *
 * const decrypted = encryptor.decrypt(encrypted);
 * // decrypted => { client_id: 'abc', client_secret: 's3cret' }
 * ```
 *
 * @param config - Encryption configuration specifying provider, fields, and optional prefix.
 * @returns A selective field encryptor instance.
 */
export function selectiveFieldEncryptor<T extends object, F extends keyof T>(config: SelectiveFieldEncryptionConfig<T, F>): SelectiveFieldEncryptor<T, F> {
  const { provider, fields, prefix: prefixInput } = config;
  const prefix = prefixInput ?? DEFAULT_ENCRYPTED_FIELD_PREFIX;
  const fieldSet = new Set<string>(fields as unknown as string[]);

  const result: SelectiveFieldEncryptor<T, F> = {
    encrypt(input: T): SelectivelyEncryptedObject<T, F> {
      const output: Record<string, unknown> = {};
      const inputRecord = input as Record<string, unknown>;

      for (const key of Object.keys(inputRecord)) {
        if (fieldSet.has(key)) {
          const json = JSON.stringify(inputRecord[key]);
          output[`${prefix}${key}`] = provider.encrypt(json);
        } else {
          output[key] = inputRecord[key];
        }
      }

      return output as SelectivelyEncryptedObject<T, F>;
    },
    decrypt(input: SelectivelyEncryptedObject<T, F>): T {
      const output: Record<string, unknown> = {};
      const inputRecord = input as Record<string, unknown>;

      for (const key of Object.keys(inputRecord)) {
        let handled = false;

        if (key.startsWith(prefix)) {
          const originalKey = key.slice(prefix.length);

          if (fieldSet.has(originalKey)) {
            const decrypted = provider.decrypt(inputRecord[key] as EncryptedString);
            output[originalKey] = JSON.parse(decrypted) as Maybe<T[F]>;
            handled = true;
          }
        }

        if (!handled) {
          output[key] = inputRecord[key];
        }
      }

      return output as T;
    }
  };

  return result;
}
