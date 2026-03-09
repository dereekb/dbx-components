import { Injectable, Inject, Optional } from '@nestjs/common';
import { type Firestore } from 'firebase-admin/firestore';
import { type Storage } from '@google-cloud/storage';
import { createCipheriv, createDecipheriv, randomBytes, generateKeyPairSync } from 'crypto';
import { type JwksKeyDocument, type JwksServiceConfig, type JsonWebKeyWithKid, DEFAULT_JWKS_COLLECTION_NAME, DEFAULT_ROTATED_KEY_MAX_AGE } from './jwks';

// MARK: DI Tokens
export const JWKS_SERVICE_CONFIG_TOKEN = 'JWKS_SERVICE_CONFIG_TOKEN';
export const GCS_STORAGE_TOKEN = 'GCS_STORAGE_TOKEN';

// MARK: Encryption helpers
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// MARK: Service
@Injectable()
export class JwksService {
  private readonly collectionName: string;
  private readonly encryptionSecret: string;
  private readonly rotatedKeyMaxAge: number;
  private readonly firestore: Firestore;
  private readonly storage?: Storage;

  constructor(@Inject(JWKS_SERVICE_CONFIG_TOKEN) config: JwksServiceConfig, @Optional() @Inject(GCS_STORAGE_TOKEN) storage?: Storage) {
    this.firestore = config.firestore;
    this.collectionName = config.collectionName ?? DEFAULT_JWKS_COLLECTION_NAME;
    this.encryptionSecret = config.encryptionSecret;
    this.rotatedKeyMaxAge = config.rotatedKeyMaxAge ?? DEFAULT_ROTATED_KEY_MAX_AGE;
    this.storage = storage;
  }

  private get collection() {
    return this.firestore.collection(this.collectionName);
  }

  /**
   * Generates a new RS256 key pair and stores it in Firestore.
   * The private key is encrypted at rest.
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

    const encryptedPrivateKey = encrypt(JSON.stringify({ ...(privateKey as JsonWebKey), kid, alg: 'RS256', use: 'sig' }), this.encryptionSecret);

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
    const decrypted = decrypt(data.privateKey, this.encryptionSecret);
    return JSON.parse(decrypted) as JsonWebKeyWithKid;
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
