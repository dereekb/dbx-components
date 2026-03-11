import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { resolveEncryptionKey, encryptValue, decryptValue, type FirestoreEncryptedFieldSecretSource } from '@dereekb/firebase-server';
import { FirebaseStorageAccessorFile, iterateFirestoreDocumentSnapshotPairs, type FirestoreDocumentSnapshotDataPairWithData, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { type JwksKey, type JsonWebKeyWithKid, OidcFirestoreCollections, type JwksKeyDocument } from '../model';
import { activeJwksKeysQuery, nonRetiredJwksKeysQuery, rotatedJwksKeysQuery } from '../model';
import { Maybe } from '@dereekb/util';

// MARK: Config
export abstract class JwksServiceConfig {
  /**
   * Encryption secret for private key storage.
   *
   * Supports all `FirestoreEncryptedFieldSecretSource` formats:
   * direct hex string, getter function, or environment variable reference.
   */
  abstract readonly encryptionSecret: FirestoreEncryptedFieldSecretSource;
  /**
   * Maximum age of a rotated key (in seconds) before it is retired.
   * Defaults to 30 days (2592000).
   */
  abstract readonly rotatedKeyMaxAge?: number;
  /**
   * If true, the JWKS will be written to storage when keys are rotated, if enabled.
   *
   * Defaults to true if `serveJwksFromStorage` is defined.
   */
  abstract readonly enableSaveJwksToStorage?: boolean;
  /**
   * If true, this flag signals to the rest of the system that the JWKS will be served from storage.
   *
   * Defaults to true if `enableSaveJwksToStorage` is true.
   */
  abstract readonly serveJwksFromStorage?: boolean;
}

/**
 * If provided, the JwksService will write the JWKS to this file when keys are rotated.
 */
export abstract class JwksServiceStorageConfig {
  /**
   * If provided, the JWKS will be written to this file when keys are rotated.
   */
  abstract readonly jwksStorageAccessorFile?: Maybe<FirebaseStorageAccessorFile>;
}

export const DEFAULT_ROTATED_KEY_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// MARK: Service
@Injectable()
export class JwksService {
  private readonly rotatedKeyMaxAge: number;

  /**
   * Whether the JWKS is served from a public storage URL rather than the built-in endpoint.
   */
  readonly serveJwksFromStorage: boolean;

  /**
   * Whether the JWKS should be saved to storage when keys are rotated.
   */
  readonly saveJwksToStorage: boolean;

  constructor(
    @Inject(JwksServiceConfig) private readonly config: JwksServiceConfig,
    @Inject(OidcFirestoreCollections) private readonly collections: OidcFirestoreCollections,
    @Optional() @Inject(JwksServiceStorageConfig) private readonly storageConfig?: Maybe<JwksServiceStorageConfig>
  ) {
    this.rotatedKeyMaxAge = config.rotatedKeyMaxAge ?? DEFAULT_ROTATED_KEY_MAX_AGE;

    const hasStorageFile = storageConfig?.jwksStorageAccessorFile != null;
    this.saveJwksToStorage = config.enableSaveJwksToStorage ?? hasStorageFile;
    this.serveJwksFromStorage = config.serveJwksFromStorage ?? this.saveJwksToStorage;
  }

  private get jwksKeyCollection() {
    return this.collections.jwksKeyCollection;
  }

  /**
   * Generates a new RS256 key pair and stores it in Firestore.
   * The private key is encrypted at rest using AES-256-GCM.
   */
  async generateKeyPair(): Promise<JwksKey> {
    const { publicKey, privateKey } = generateKeyPairSync('rsa' as any, {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'jwk' } as any,
      privateKeyEncoding: { type: 'pkcs8', format: 'jwk' } as any
    });

    const kid = randomBytes(16).toString('hex');

    const publicJwk: JsonWebKeyWithKid = {
      ...(publicKey as JsonWebKey),
      kid,
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig'
    };

    const getKey = resolveEncryptionKey(this.config.encryptionSecret);
    const encryptedPrivateKey = encryptValue({ ...(privateKey as JsonWebKey), kid, alg: 'RS256', use: 'sig' }, getKey());

    const data: JwksKey = {
      privateKey: encryptedPrivateKey,
      publicKey: publicJwk,
      status: 'active',
      createdAt: new Date()
    };

    const doc = this.jwksKeyCollection.documentAccessor().loadDocumentForId(kid);
    await doc.accessor.set(data);
    return data;
  }

  /**
   * Returns the currently active signing key's private JWK.
   */
  async getActiveSigningKey(): Promise<JsonWebKeyWithKid | undefined> {
    const results = await this.jwksKeyCollection.query(activeJwksKeysQuery()).getDocs();
    let result: JsonWebKeyWithKid | undefined;

    if (!results.empty) {
      const data = results.docs[0].data();
      const getKey = resolveEncryptionKey(this.config.encryptionSecret);
      result = decryptValue<JsonWebKeyWithKid>(data.privateKey, getKey());
    }

    return result;
  }

  /**
   * Returns the public URL for the JWKS stored in Cloud Storage, if configured.
   *
   * Returns undefined if storage is not configured or `serveJwksFromStorage` is false.
   */
  async getJwksStoragePublicUrl(): Promise<Maybe<string>> {
    let result: Maybe<string>;

    if (this.serveJwksFromStorage && this.storageConfig?.jwksStorageAccessorFile) {
      result = await this.storageConfig.jwksStorageAccessorFile.getDownloadUrl();
    }

    return result;
  }

  /**
   * Returns the public JWKS (all non-retired keys) by querying Firestore.
   */
  async getLatestPublicJwks(): Promise<{ keys: JsonWebKeyWithKid[] }> {
    const keys: JsonWebKeyWithKid[] = [];

    await iterateFirestoreDocumentSnapshotPairs({
      documentAccessor: this.jwksKeyCollection.documentAccessor(),
      queryFactory: this.jwksKeyCollection,
      constraintsFactory: (): FirestoreQueryConstraint[] => nonRetiredJwksKeysQuery(),
      iterateSnapshotPair: async (pair: FirestoreDocumentSnapshotDataPairWithData<JwksKeyDocument>) => {
        keys.push(pair.data.publicKey);
      }
    });

    return { keys };
  }

  /**
   * Rotates keys: marks the current active key as rotated and generates a new active key.
   */
  async rotateKeys(): Promise<JwksKey> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.rotatedKeyMaxAge * 1000);

    await iterateFirestoreDocumentSnapshotPairs({
      documentAccessor: this.jwksKeyCollection.documentAccessor(),
      queryFactory: this.jwksKeyCollection,
      constraintsFactory: (): FirestoreQueryConstraint[] => activeJwksKeysQuery(),
      iterateSnapshotPair: async (pair: FirestoreDocumentSnapshotDataPairWithData<JwksKeyDocument>) => {
        await pair.document.accessor.set({ status: 'rotated', rotatedAt: now, expiresAt } as Partial<JwksKey>, { merge: true });
      }
    });

    const newKey = await this.generateKeyPair();

    if (this.saveJwksToStorage && this.storageConfig?.jwksStorageAccessorFile) {
      const jwks = await this.getLatestPublicJwks();
      const data = Buffer.from(JSON.stringify(jwks));
      await this.storageConfig.jwksStorageAccessorFile.upload(data, { contentType: 'application/json' });
    }

    return newKey;
  }

  /**
   * Retires rotated keys whose expiresAt has passed.
   */
  async retireExpiredKeys(): Promise<number> {
    const now = new Date();
    let count = 0;

    await iterateFirestoreDocumentSnapshotPairs({
      documentAccessor: this.jwksKeyCollection.documentAccessor(),
      queryFactory: this.jwksKeyCollection,
      constraintsFactory: (): FirestoreQueryConstraint[] => rotatedJwksKeysQuery(),
      iterateSnapshotPair: async (pair: FirestoreDocumentSnapshotDataPairWithData<JwksKeyDocument>) => {
        if (pair.data.expiresAt && pair.data.expiresAt <= now) {
          await pair.document.accessor.set({ status: 'retired' } as Partial<JwksKey>, { merge: true });
          count++;
        }
      }
    });

    return count;
  }
}
