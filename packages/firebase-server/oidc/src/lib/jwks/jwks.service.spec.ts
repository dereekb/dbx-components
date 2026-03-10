import { JwksService, JWKS_SERVICE_CONFIG_TOKEN, GCS_STORAGE_TOKEN } from './jwks.service';
import { type JwksServiceConfig } from './jwks';
import { randomBytes } from 'crypto';

// MARK: Mock Firestore
function createMockFirestore() {
  const store = new Map<string, Map<string, { data: Record<string, unknown> }>>();

  function getCollection(name: string) {
    if (!store.has(name)) {
      store.set(name, new Map());
    }
    return store.get(name)!;
  }

  const batchOps: Array<() => void> = [];

  const firestore = {
    collection(name: string) {
      const col = getCollection(name);

      return {
        doc(id: string) {
          return {
            set(data: Record<string, unknown>) {
              col.set(id, { data: { ...data } });
              return Promise.resolve();
            },
            get() {
              const entry = col.get(id);
              return Promise.resolve({
                exists: !!entry,
                data: () => (entry ? { ...entry.data } : undefined),
                ref: { id, update: (d: Record<string, unknown>) => Object.assign(entry!.data, d) }
              });
            }
          };
        },
        where(field: string, op: string, value: unknown) {
          return {
            limit(n: number) {
              return {
                get() {
                  const results: Array<{ data: () => Record<string, unknown>; ref: { id: string; update: (d: Record<string, unknown>) => void } }> = [];
                  for (const [docId, entry] of col.entries()) {
                    const fieldVal = (entry.data as Record<string, unknown>)[field];
                    const matches = op === '==' ? fieldVal === value : op === 'in' ? (value as unknown[]).includes(fieldVal) : false;
                    if (matches) {
                      results.push({
                        data: () => ({ ...entry.data }),
                        ref: {
                          id: docId,
                          update: (d: Record<string, unknown>) => Object.assign(entry.data, d)
                        }
                      });
                      if (results.length >= n) break;
                    }
                  }
                  return Promise.resolve({ empty: results.length === 0, docs: results });
                }
              };
            },
            get() {
              const results: Array<{ data: () => Record<string, unknown>; ref: { id: string; update: (d: Record<string, unknown>) => void } }> = [];
              for (const [docId, entry] of col.entries()) {
                const fieldVal = (entry.data as Record<string, unknown>)[field];
                const matches = op === '==' ? fieldVal === value : op === 'in' ? (value as unknown[]).includes(fieldVal) : false;
                if (matches) {
                  results.push({
                    data: () => ({ ...entry.data }),
                    ref: {
                      id: docId,
                      update: (d: Record<string, unknown>) => Object.assign(entry.data, d)
                    }
                  });
                }
              }
              return Promise.resolve({ empty: results.length === 0, docs: results });
            }
          };
        }
      };
    },
    batch() {
      batchOps.length = 0;
      return {
        update(ref: { update: (d: Record<string, unknown>) => void }, data: Record<string, unknown>) {
          batchOps.push(() => ref.update(data));
        },
        delete(ref: { delete: () => void }) {
          batchOps.push(() => ref.delete());
        },
        commit() {
          batchOps.forEach((op) => op());
          batchOps.length = 0;
          return Promise.resolve();
        }
      };
    },
    _store: store
  };

  return firestore;
}

describe('JwksService', () => {
  let service: JwksService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  const encryptionSecret = randomBytes(32).toString('hex');

  beforeEach(() => {
    mockFirestore = createMockFirestore();

    const config: JwksServiceConfig = {
      encryptionSecret
    };

    service = new JwksService(config, mockFirestore as any);
  });

  describe('generateKeyPair()', () => {
    it('should generate a key pair and store it in Firestore', async () => {
      const doc = await service.generateKeyPair();

      expect(doc.keyId).toBeDefined();
      expect(doc.status).toBe('active');
      expect(doc.publicKey).toBeDefined();
      expect(doc.publicKey.kid).toBe(doc.keyId);
      expect(doc.publicKey.kty).toBe('RSA');
      expect(doc.publicKey.alg).toBe('RS256');
      expect(doc.publicKey.use).toBe('sig');
      expect(doc.createdAt).toBeInstanceOf(Date);

      // Private key should be encrypted (base64 string, not JSON)
      expect(doc.privateKey).toBeDefined();
      expect(() => JSON.parse(doc.privateKey)).toThrow(); // encrypted, not plain JSON
    });

    it('should store the key in the default collection', async () => {
      const doc = await service.generateKeyPair();
      const col = mockFirestore._store.get('oidc_jwks');

      expect(col).toBeDefined();
      expect(col!.has(doc.keyId)).toBe(true);
    });
  });

  describe('getActiveSigningKey()', () => {
    it('should return the active signing key as decrypted JWK', async () => {
      await service.generateKeyPair();
      const key = await service.getActiveSigningKey();

      expect(key).toBeDefined();
      expect(key!.kid).toBeDefined();
      expect(key!.kty).toBe('RSA');
      expect(key!.alg).toBe('RS256');
      // Private key should have 'd' component
      expect((key as any).d).toBeDefined();
    });

    it('should return undefined when no active key exists', async () => {
      const key = await service.getActiveSigningKey();
      expect(key).toBeUndefined();
    });
  });

  describe('getPublicJwks()', () => {
    it('should return public keys for all non-retired keys', async () => {
      await service.generateKeyPair();
      const jwks = await service.getPublicJwks();

      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0].kty).toBe('RSA');
      expect(jwks.keys[0].kid).toBeDefined();
      // Public key should NOT have 'd' component
      expect((jwks.keys[0] as any).d).toBeUndefined();
    });
  });

  describe('rotateKeys()', () => {
    it('should mark the current active key as rotated and create a new active key', async () => {
      const originalKey = await service.generateKeyPair();
      const newKey = await service.rotateKeys();

      expect(newKey.keyId).not.toBe(originalKey.keyId);
      expect(newKey.status).toBe('active');

      // Old key should be marked as rotated in Firestore
      const col = mockFirestore._store.get('oidc_jwks');
      const oldKeyData = col?.get(originalKey.keyId)?.data;
      expect(oldKeyData?.status).toBe('rotated');
      expect(oldKeyData?.rotatedAt).toBeDefined();
      expect(oldKeyData?.expiresAt).toBeDefined();
    });

    it('should include both active and rotated keys in JWKS', async () => {
      await service.generateKeyPair();
      await service.rotateKeys();

      const jwks = await service.getPublicJwks();
      expect(jwks.keys).toHaveLength(2);
    });
  });

  describe('publishJwksToGcs()', () => {
    it('should throw if GCS storage is not configured', async () => {
      await expect(service.publishJwksToGcs('bucket', 'path')).rejects.toThrow('GCS Storage is not configured');
    });

    it('should upload JWKS JSON to GCS', async () => {
      let savedContent: string | undefined;
      let savedOptions: Record<string, unknown> | undefined;

      const mockStorage = {
        bucket(name: string) {
          return {
            file(path: string) {
              return {
                save(content: string, options: Record<string, unknown>) {
                  savedContent = content;
                  savedOptions = options;
                  return Promise.resolve();
                }
              };
            }
          };
        }
      };

      const config: JwksServiceConfig = {
        encryptionSecret
      };

      const serviceWithGcs = new JwksService(config, mockFirestore as any, mockStorage as any);
      await serviceWithGcs.generateKeyPair();
      await serviceWithGcs.publishJwksToGcs('my-bucket', 'jwks.json');

      expect(savedContent).toBeDefined();
      const parsed = JSON.parse(savedContent!);
      expect(parsed.keys).toHaveLength(1);
      expect(savedOptions?.contentType).toBe('application/json');
    });
  });

  describe('retireExpiredKeys()', () => {
    it('should retire rotated keys past their expiresAt', async () => {
      await service.generateKeyPair();
      await service.rotateKeys();

      // Manually set the old key's expiresAt to the past
      const col = mockFirestore._store.get('oidc_jwks');
      for (const [, entry] of col!.entries()) {
        if (entry.data.status === 'rotated') {
          entry.data.expiresAt = new Date(Date.now() - 1000);
        }
      }

      const count = await service.retireExpiredKeys();
      expect(count).toBe(1);

      // Verify the key is now retired
      for (const [, entry] of col!.entries()) {
        if (entry.data.keyId !== (await service.getActiveSigningKey())?.kid) {
          expect(entry.data.status).toBe('retired');
        }
      }
    });

    it('should not retire keys that have not expired', async () => {
      await service.generateKeyPair();
      await service.rotateKeys();

      const count = await service.retireExpiredKeys();
      expect(count).toBe(0);
    });
  });
});
