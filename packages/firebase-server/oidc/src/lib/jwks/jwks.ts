import { type FirestoreEncryptedFieldSecretSource } from '@dereekb/firebase-server';

// MARK: Identity
/**
 * Model identity for JWKS signing keys.
 *
 * Follows the `firestoreModelIdentity()` naming convention from `@dereekb/firebase`.
 * Defined inline to avoid importing `@dereekb/firebase` which causes rollup issues
 * with transitive source resolution.
 */
export const jwksKeyIdentity = {
  type: 'root' as const,
  modelType: 'jwksKey',
  collectionName: 'oidc_jwks',
  collectionType: 'oidc_jwks'
};

// MARK: Types
export type JwksKeyStatus = 'active' | 'rotated' | 'retired';

/**
 * Document stored in Firestore representing a JWKS signing key.
 */
export interface JwksKeyDocument {
  /**
   * Unique key identifier (kid).
   */
  readonly keyId: string;
  /**
   * Private key in JWK format, encrypted at rest.
   */
  readonly privateKey: string;
  /**
   * Public key in JWK format (plain text for JWKS endpoint).
   */
  readonly publicKey: JsonWebKeyWithKid;
  /**
   * Current lifecycle status.
   */
  readonly status: JwksKeyStatus;
  /**
   * When this key was created.
   */
  readonly createdAt: Date;
  /**
   * When this key was rotated (status changed from active to rotated).
   */
  readonly rotatedAt?: Date;
  /**
   * When tokens signed with this key will all have expired.
   * Used to determine when the key can be retired.
   */
  readonly expiresAt?: Date;
}

/**
 * JWK with a required kid field.
 */
export interface JsonWebKeyWithKid extends JsonWebKey {
  readonly kid: string;
  readonly kty: string;
  readonly alg?: string;
  readonly use?: string;
}

// MARK: Config
export interface JwksServiceConfig {
  /**
   * Collection name for JWKS key documents.
   * Defaults to `jwksKeyIdentity.collectionName` ('oidc_jwks').
   */
  readonly collectionName?: string;
  /**
   * Encryption secret for private key storage.
   *
   * Supports all `FirestoreEncryptedFieldSecretSource` formats:
   * direct hex string, getter function, or environment variable reference.
   */
  readonly encryptionSecret: FirestoreEncryptedFieldSecretSource;
  /**
   * Maximum age of a rotated key (in seconds) before it is retired.
   * Defaults to 30 days (2592000).
   */
  readonly rotatedKeyMaxAge?: number;
}

export const DEFAULT_ROTATED_KEY_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
