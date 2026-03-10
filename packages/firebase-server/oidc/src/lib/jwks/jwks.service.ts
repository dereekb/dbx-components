import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { resolveEncryptionKey, encryptValue, decryptValue, type FirestoreEncryptedFieldSecretSource } from '@dereekb/firebase-server';
import { iterateFirestoreDocumentSnapshotPairs, type FirestoreDocumentSnapshotDataPairWithData, type FirestoreQueryConstraint } from '@dereekb/firebase';
import { type JwksKey, type JsonWebKeyWithKid, JwksFirestoreCollections, type JwksKeyDocument } from '../model';
import { activeJwksKeysQuery, nonRetiredJwksKeysQuery, rotatedJwksKeysQuery } from '../model';

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
}

export const DEFAULT_ROTATED_KEY_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// MARK: Service
@Injectable()
export class JwksService {
  private readonly rotatedKeyMaxAge: number;

  constructor(
    @Inject(JwksServiceConfig) private readonly config: JwksServiceConfig,
    @Inject(JwksFirestoreCollections) private readonly collections: JwksFirestoreCollections
  ) {
    this.rotatedKeyMaxAge = config.rotatedKeyMaxAge ?? DEFAULT_ROTATED_KEY_MAX_AGE;
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

    const key = resolveEncryptionKey(this.config.encryptionSecret);
    const encryptedPrivateKey = encryptValue({ ...(privateKey as JsonWebKey), kid, alg: 'RS256', use: 'sig' }, key);

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
      const key = resolveEncryptionKey(this.config.encryptionSecret);
      result = decryptValue<JsonWebKeyWithKid>(data.privateKey, key);
    }

    return result;
  }

  /**
   * Returns the public JWKS (all non-retired keys) for the discovery endpoint.
   */
  async getPublicJwks(): Promise<{ keys: JsonWebKeyWithKid[] }> {
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

    return this.generateKeyPair();
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
