import { hkdfSync } from 'node:crypto';
import { type AES256GCMEncryptionSecret, type AES256GCMEncryptionSecretSource, resolveEncryptionKey } from './json.encrypt';

/**
 * Byte length of a derived AES-256 key.
 */
const DERIVED_AES256GCM_KEY_LENGTH = 32;

/**
 * Input for {@link deriveAES256GCMEncryptionSecret}.
 */
export interface DeriveAES256GCMEncryptionSecretInput {
  /**
   * The parent secret to derive from. Must itself be a valid 64-character hex AES-256-GCM secret.
   */
  readonly secret: AES256GCMEncryptionSecretSource;
  /**
   * The HKDF `info` label that separates the derived key from the parent and from every other derivation.
   *
   * Use a versioned, feature-specific label (e.g. `'dbx-components/userExternalConnectionData/v1'`). Changing it
   * changes the key, so treat it as write-once like the parent secret.
   */
  readonly info: string;
}

/**
 * Derives a new AES-256-GCM secret from a parent secret with HKDF-SHA256.
 *
 * Deterministic: the same parent secret and `info` always produce the same key, so a feature can hold its own
 * key without a new environment variable. Different `info` labels produce unrelated keys, so ciphertext written
 * under one derivation cannot be decrypted (or replayed) under another, nor under the parent.
 *
 * Rotating the parent secret rotates every derived key with it.
 *
 * @param input - The parent secret and the separating `info` label.
 * @returns A 64-character hex secret usable anywhere an {@link AES256GCMEncryptionSecret} is accepted.
 * @throws {Error} When the parent secret is not a valid 64-character hex key, or `info` is empty.
 *
 * @example
 * ```typescript
 * const dataSecret = deriveAES256GCMEncryptionSecret({ secret: process.env.FAMILY_SECRET, info: 'my-app/feature/v1' });
 * ```
 */
export function deriveAES256GCMEncryptionSecret(input: DeriveAES256GCMEncryptionSecretInput): AES256GCMEncryptionSecret {
  const { secret, info } = input;

  if (!info) {
    throw new Error('deriveAES256GCMEncryptionSecret: info is required.');
  }

  const parentKey = resolveEncryptionKey(secret)();
  const derived = hkdfSync('sha256', parentKey, Buffer.alloc(0), info, DERIVED_AES256GCM_KEY_LENGTH);
  return Buffer.from(derived).toString('hex');
}
