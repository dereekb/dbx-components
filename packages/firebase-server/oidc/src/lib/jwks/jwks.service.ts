import { Injectable, Inject, Optional } from '@nestjs/common';
import { type Firestore } from 'firebase-admin/firestore';
import { type Storage } from '@google-cloud/storage';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { FIREBASE_FIRESTORE_TOKEN } from '@dereekb/firebase-server';
import { resolveEncryptionKey, encryptValue, decryptValue } from '@dereekb/firebase-server';
import { type JwksKeyDocument, type JwksServiceConfig, type JsonWebKeyWithKid, DEFAULT_ROTATED_KEY_MAX_AGE, jwksKeyIdentity } from './jwks';

// MARK: DI Tokens
export const JWKS_SERVICE_CONFIG_TOKEN = 'JWKS_SERVICE_CONFIG_TOKEN';
export const GCS_STORAGE_TOKEN = 'GCS_STORAGE_TOKEN';

// MARK: Service
@Injectable()
export class JwksService {
  private readonly collectionName: string;
  private readonly rotatedKeyMaxAge: number;

  constructor(
    @Inject(JWKS_SERVICE_CONFIG_TOKEN) private readonly config: JwksServiceConfig,
    @Inject(FIREBASE_FIRESTORE_TOKEN) private readonly firestore: Firestore,
    @Optional() @Inject(GCS_STORAGE_TOKEN) private readonly storage?: Storage
  ) {
    this.collectionName = config.collectionName ?? jwksKeyIdentity.collectionName;
    this.rotatedKeyMaxAge = config.rotatedKeyMaxAge ?? DEFAULT_ROTATED_KEY_MAX_AGE;
  }

  private get collection() {
    return this.firestore.collection(this.collectionName);
  }

  /**
   * Generates a new RS256 key pair and stores it in Firestore.
   * The private key is encrypted at rest using AES-256-GCM.
   */
  async generateKeyPair(): Promise<JwksKeyDocument> {
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

    const doc: JwksKeyDocument = {
      keyId: kid,
      privateKey: encryptedPrivateKey,
      publicKey: publicJwk,
      status: 'active',
      createdAt: new Date()
    };

    await this.collection.doc(kid).set(doc);
    return doc;
  }

  /**
   * Returns the currently active signing key's private JWK.
   */
  async getActiveSigningKey(): Promise<JsonWebKeyWithKid | undefined> {
    const results = await this.collection.where('status', '==', 'active').limit(1).get();

    if (results.empty) {
      return undefined;
    }

    const data = results.docs[0].data() as JwksKeyDocument;
    const key = resolveEncryptionKey(this.config.encryptionSecret);
    return decryptValue<JsonWebKeyWithKid>(data.privateKey, key);
  }

  /**
   * Returns the public JWKS (all non-retired keys) for the discovery endpoint.
   */
  async getPublicJwks(): Promise<{ keys: JsonWebKeyWithKid[] }> {
    const results = await this.collection.where('status', 'in', ['active', 'rotated']).get();
    const keys = results.docs.map((doc) => (doc.data() as JwksKeyDocument).publicKey);
    return { keys };
  }

  /**
   * Rotates keys: marks the current active key as rotated and generates a new active key.
   */
  async rotateKeys(): Promise<JwksKeyDocument> {
    const activeResults = await this.collection.where('status', '==', 'active').get();

    const batch = this.firestore.batch();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.rotatedKeyMaxAge * 1000);

    activeResults.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'rotated',
        rotatedAt: now,
        expiresAt
      });
    });

    await batch.commit();
    return this.generateKeyPair();
  }

  /**
   * Publishes the current public JWKS to a GCS bucket.
   */
  async publishJwksToGcs(bucket: string, path: string): Promise<void> {
    if (!this.storage) {
      throw new Error('GCS Storage is not configured. Provide GCS_STORAGE_TOKEN to use this feature.');
    }

    const jwks = await this.getPublicJwks();
    const file = this.storage.bucket(bucket).file(path);

    await file.save(JSON.stringify(jwks), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'public, max-age=300, stale-while-revalidate=60'
      }
    });
  }

  /**
   * Retires rotated keys whose expiresAt has passed.
   */
  async retireExpiredKeys(): Promise<number> {
    const results = await this.collection.where('status', '==', 'rotated').get();
    const now = new Date();

    const batch = this.firestore.batch();
    let count = 0;

    results.docs.forEach((doc) => {
      const data = doc.data() as JwksKeyDocument;
      const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt ? new Date((data.expiresAt as any).toDate?.() ?? data.expiresAt) : undefined;

      if (expiresAt && expiresAt <= now) {
        batch.update(doc.ref, { status: 'retired' });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  }
}
