import { createFirestoreOidcAdapterFactory, type OidcAdapterPayload } from './firestore.adapter';

// MARK: Mock Firestore
interface MockDocData {
  data: Record<string, unknown>;
}

function createMockFirestore() {
  const store = new Map<string, Map<string, MockDocData>>();

  function getCollection(name: string): Map<string, MockDocData> {
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
            set(data: Record<string, unknown>, _options?: unknown) {
              const existing = col.get(id);
              const merged = existing ? { ...existing.data, ...data } : { ...data };
              col.set(id, { data: merged });
              return Promise.resolve();
            },
            get() {
              const entry = col.get(id);
              return Promise.resolve({
                exists: !!entry,
                data: () => (entry ? { ...entry.data } : undefined)
              });
            },
            update(data: Record<string, unknown>) {
              const entry = col.get(id);
              if (entry) {
                Object.assign(entry.data, data);
              }
              return Promise.resolve();
            },
            delete() {
              col.delete(id);
              return Promise.resolve();
            },
            get ref() {
              return { id, delete: () => col.delete(id) };
            }
          };
        },
        where(field: string, _op: string, value: unknown) {
          return {
            limit(_n: number) {
              return {
                get() {
                  const results: Array<{ data: () => Record<string, unknown>; ref: { id: string; delete: () => void } }> = [];
                  for (const [docId, entry] of col.entries()) {
                    if ((entry.data as Record<string, unknown>)[field] === value) {
                      results.push({
                        data: () => ({ ...entry.data }),
                        ref: {
                          id: docId,
                          delete: () => col.delete(docId)
                        }
                      });
                    }
                  }
                  return Promise.resolve({ empty: results.length === 0, docs: results });
                }
              };
            },
            get() {
              const results: Array<{ data: () => Record<string, unknown>; ref: { id: string; delete: () => void } }> = [];
              for (const [docId, entry] of col.entries()) {
                if ((entry.data as Record<string, unknown>)[field] === value) {
                  results.push({
                    data: () => ({ ...entry.data }),
                    ref: {
                      id: docId,
                      delete: () => col.delete(docId)
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

describe('FirestoreOidcAdapter', () => {
  describe('createFirestoreOidcAdapterFactory()', () => {
    let mockFirestore: ReturnType<typeof createMockFirestore>;
    let AdapterClass: ReturnType<typeof createFirestoreOidcAdapterFactory>;

    beforeEach(() => {
      mockFirestore = createMockFirestore();
      AdapterClass = createFirestoreOidcAdapterFactory({
        firestore: mockFirestore as any
      });
    });

    describe('upsert()', () => {
      it('should store a payload with TTL', async () => {
        const adapter = new AdapterClass('AccessToken');
        const payload: OidcAdapterPayload = { grantId: 'g1', scope: 'openid' };

        await adapter.upsert('token1', payload, 900);

        const result = await adapter.find('token1');
        expect(result).toBeDefined();
        expect(result!.grantId).toBe('g1');
        expect(result!.scope).toBe('openid');
      });

      it('should set expiresAt field from expiresIn seconds', async () => {
        const adapter = new AdapterClass('AccessToken');
        const before = Math.floor(Date.now() / 1000);

        await adapter.upsert('token1', {}, 3600);

        const col = mockFirestore._store.get('oidc_accesstokens');
        const doc = col?.get('token1');
        expect(doc).toBeDefined();

        const expiresAt = doc!.data.expiresAt as Date;
        expect(expiresAt).toBeInstanceOf(Date);

        const expiresAtEpoch = Math.floor(expiresAt.getTime() / 1000);
        expect(expiresAtEpoch).toBeGreaterThanOrEqual(before + 3600);
        expect(expiresAtEpoch).toBeLessThanOrEqual(before + 3601);
      });

      it('should merge on re-upsert', async () => {
        const adapter = new AdapterClass('Session');

        await adapter.upsert('s1', { uid: 'u1', extra: 'a' }, 3600);
        await adapter.upsert('s1', { uid: 'u1', extra: 'b' }, 3600);

        const result = await adapter.find('s1');
        expect(result?.extra).toBe('b');
      });
    });

    describe('find()', () => {
      it('should return undefined for missing doc', async () => {
        const adapter = new AdapterClass('Session');
        const result = await adapter.find('nonexistent');
        expect(result).toBeUndefined();
      });

      it('should return undefined for expired doc', async () => {
        const adapter = new AdapterClass('AccessToken');

        // Manually insert an expired doc
        const col = mockFirestore._store.get('oidc_accesstokens') ?? new Map();
        mockFirestore._store.set('oidc_accesstokens', col);
        col.set('expired1', {
          data: {
            expiresAt: {
              toDate: () => new Date(Date.now() - 10000)
            }
          }
        });

        const result = await adapter.find('expired1');
        expect(result).toBeUndefined();
      });
    });

    describe('findByUserCode()', () => {
      it('should find a document by userCode field', async () => {
        const adapter = new AdapterClass('DeviceCode');

        await adapter.upsert('dc1', { userCode: 'ABCD-1234', scope: 'openid' }, 600);

        const result = await adapter.findByUserCode('ABCD-1234');
        expect(result).toBeDefined();
        expect(result!.userCode).toBe('ABCD-1234');
      });

      it('should return undefined when userCode not found', async () => {
        const adapter = new AdapterClass('DeviceCode');
        const result = await adapter.findByUserCode('NONE');
        expect(result).toBeUndefined();
      });
    });

    describe('findByUid()', () => {
      it('should find a document by uid field', async () => {
        const adapter = new AdapterClass('Session');

        await adapter.upsert('s1', { uid: 'session-uid-1' }, 3600);

        const result = await adapter.findByUid('session-uid-1');
        expect(result).toBeDefined();
        expect(result!.uid).toBe('session-uid-1');
      });

      it('should return undefined when uid not found', async () => {
        const adapter = new AdapterClass('Session');
        const result = await adapter.findByUid('nonexistent');
        expect(result).toBeUndefined();
      });
    });

    describe('consume()', () => {
      it('should set consumed timestamp on the doc', async () => {
        const adapter = new AdapterClass('AuthorizationCode');
        await adapter.upsert('ac1', { grantId: 'g1' }, 60);

        const before = Math.floor(Date.now() / 1000);
        await adapter.consume('ac1');

        const result = await adapter.find('ac1');
        expect(result?.consumed).toBeDefined();
        expect(result!.consumed).toBeGreaterThanOrEqual(before);
      });
    });

    describe('destroy()', () => {
      it('should delete the doc', async () => {
        const adapter = new AdapterClass('Session');
        await adapter.upsert('s1', { uid: 'u1' }, 3600);
        await adapter.destroy('s1');

        const result = await adapter.find('s1');
        expect(result).toBeUndefined();
      });
    });

    describe('revokeByGrantId()', () => {
      it('should delete all docs matching grantId for grantable models', async () => {
        const adapter = new AdapterClass('AccessToken');

        await adapter.upsert('t1', { grantId: 'g1' }, 900);
        await adapter.upsert('t2', { grantId: 'g1' }, 900);
        await adapter.upsert('t3', { grantId: 'g2' }, 900);

        await adapter.revokeByGrantId('g1');

        expect(await adapter.find('t1')).toBeUndefined();
        expect(await adapter.find('t2')).toBeUndefined();
        expect(await adapter.find('t3')).toBeDefined();
      });

      it('should be a no-op for non-grantable models', async () => {
        const adapter = new AdapterClass('Session');
        await adapter.upsert('s1', { grantId: 'g1' }, 3600);

        await adapter.revokeByGrantId('g1');

        // Session is not grantable, so it should still exist
        expect(await adapter.find('s1')).toBeDefined();
      });
    });

    describe('collection prefix', () => {
      it('should use default prefix oidc_', () => {
        const adapter = new AdapterClass('Session') as any;
        expect(adapter.collectionName).toBe('oidc_sessions');
      });

      it('should use custom prefix', () => {
        const CustomAdapter = createFirestoreOidcAdapterFactory({
          firestore: mockFirestore as any,
          collectionPrefix: 'custom_'
        });

        const adapter = new CustomAdapter('AccessToken') as any;
        expect(adapter.collectionName).toBe('custom_accesstokens');
      });
    });
  });
});
