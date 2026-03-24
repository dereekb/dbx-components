import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { resolveEncryptionKey, encryptValue, decryptValue, type AES256GCMEncryptionSecretSource } from '@dereekb/nestjs';
import { type FirebaseStorageAccessorFile, iterateFirestoreDocumentSnapshotPairs, type FirestoreDocumentSnapshotDataPairWithData, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { type JwksKey, type JsonWebKeyWithKid, type JwksKeyDocument } from '../model/jwks/jwks';
import { activeJwksKeysQuery, nonRetiredJwksKeysQuery, rotatedJwksKeysQuery } from '../model/jwks/jwks.query';
import { cachedGetter, type WebsiteUrlWithPrefix, type Maybe } from '@dereekb/util';
import { OidcServerFirestoreCollections } from '../model/model';

// MARK: Types
/**
 * Result of {@link JwksService.generateKeyPair}.
 */
export interface GenerateKeyPairResult {
  /**
   * The stored Firestore document data (private key is encrypted).
   */
  readonly jwksKey: JwksKey;
  /**
   * The unencrypted private JWK, ready for use as a signing key.
   */
  readonly signingKey: JsonWebKeyWithKid;
}

// MARK: Config
export abstract class JwksServiceConfig {
  /**
   * Encryption secret for private key storage.
   *
   * Supports all `AES256GCMEncryptionSecretSource` formats:
   * direct hex string, getter function, or environment variable reference.
   */
  abstract readonly encryptionSecret: AES256GCMEncryptionSecretSource;
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
  private readonly _jwksStoragePublicUrl = cachedGetter(async () => {
    let result: Maybe<WebsiteUrlWithPrefix>;

    if (this.serveJwksFromStorage && this.storageConfig?.jwksStorageAccessorFile) {
      const _file = this.storageConfig.jwksStorageAccessorFile;

      result = await _file.getDownloadUrl().catch(async () => {
        await this._initializeKeysAndCloud(); // initialize
        return _file.getDownloadUrl().catch((e) => {
          console.error(`JwksService: Moving to api serving files - Failed while trying to init/retrieve the google storage public url: `, e);
          return null;
        }); // try to download it again
      });
    }

    return result;
  });

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
    @Inject(OidcServerFirestoreCollections) private readonly collections: OidcServerFirestoreCollections,
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
   *
   * Returns both the stored {@link JwksKey} and the unencrypted private JWK
   * so callers can use the signing key immediately without a decryption round-trip.
   *
   * @returns the generated key pair result containing the stored JwksKey and signing key
   */
  async generateKeyPair(): Promise<GenerateKeyPairResult> {
     
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

    const privateJwk: JsonWebKeyWithKid = {
      ...(privateKey as JsonWebKey),
      kid,
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig'
    };

    const getKey = resolveEncryptionKey(this.config.encryptionSecret);
    const encryptedPrivateKey = encryptValue(privateJwk, getKey());

    const data: JwksKey = {
      privateKey: encryptedPrivateKey,
      publicKey: publicJwk,
      status: 'active',
      createdAt: new Date()
    };

    const doc = this.jwksKeyCollection.documentAccessor().loadDocumentForId(kid);
    await doc.accessor.set(data);
    return { jwksKey: data, signingKey: privateJwk };
  }

  /**
   * Returns the currently active signing key's private JWK.
   *
   * @returns the active signing key's private JWK, or undefined if no active key exists
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
   * This call will also initialize/rotate the keys in the datastore and sync them
   * to the cloud if they are currently not available.
   *
   * Returns undefined if storage is not configured or `serveJwksFromStorage` is false.
   * Returns null if an error occured while trying to setup.
   *
   * @returns the public URL, or null/undefined if unavailable
   */
  async getJwksStoragePublicUrl(): Promise<Maybe<WebsiteUrlWithPrefix>> {
    return this._jwksStoragePublicUrl();
  }

  /**
   * Returns the public JWKS (all non-retired keys) by querying Firestore.
   *
   * @returns the public JWKS containing all non-retired signing keys
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
   *
   * @returns the newly generated active JwksKey
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

    const { jwksKey: newKey } = await this.generateKeyPair();
    await this._syncKeysToCloud();
    return newKey;
  }

  private async _initializeKeysAndCloud() {
    const jwks = await this.getLatestPublicJwks();

    if (!jwks.keys.length) {
      await this.rotateKeys();
    } else {
      await this._syncKeysToCloud(); // sync the keys to the cloud if they exist
    }
  }

  private async _syncKeysToCloud() {
    if (this.saveJwksToStorage && this.storageConfig?.jwksStorageAccessorFile) {
      const jwks = await this.getLatestPublicJwks();
      const data = Buffer.from(JSON.stringify(jwks));

      try {
        // Upload the file
        await this.storageConfig.jwksStorageAccessorFile.upload(data, {
          contentType: 'application/json',
          metadata: {
            contentDisposition: 'inline',
            cacheControl: 'public, max-age=300, stale-while-revalidate=60' // short cache of 5 minutes
          }
        });

        // Make sure the file is made public.
        await this.storageConfig.jwksStorageAccessorFile.makePublic?.();
      } catch (e) {
        console.error(`JwksService: Failed to rotate oidc keys to Google Cloud Store!!!`);
        throw e;
      }
    }
  }

  /**
   * Retires rotated keys whose expiresAt has passed.
   *
   * @returns the number of keys retired
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
