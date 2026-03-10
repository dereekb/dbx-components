import { where } from '@dereekb/firebase';
import { OidcAdapterFirestoreCollections, type OidcAdapterEntry, type OidcAdapterEntryFirestoreCollection } from './adapter';

// MARK: Types
/**
 * oidc-provider Adapter interface.
 *
 * Each adapter instance is created per model type (e.g., 'Session', 'AccessToken', etc.)
 */
export interface OidcProviderAdapter {
  upsert(id: string, payload: OidcAdapterPayload, expiresIn: number): Promise<void>;
  find(id: string): Promise<OidcAdapterPayload | undefined>;
  findByUserCode(userCode: string): Promise<OidcAdapterPayload | undefined>;
  findByUid(uid: string): Promise<OidcAdapterPayload | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}

export interface OidcProviderAdapterConstructor {
  new (name: string): OidcProviderAdapter;
}

/**
 * oidc-provider adapter payload.
 *
 * This is the raw payload shape that oidc-provider passes to the adapter.
 */
export interface OidcAdapterPayload {
  uid?: string;
  grantId?: string;
  userCode?: string;
  consumed?: number;
  [key: string]: unknown;
}

// MARK: Adapter
/**
 * Model types that support grantId-based revocation.
 */
const GRANTABLE_MODELS = new Set(['AccessToken', 'AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);

function epochTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Creates an oidc-provider adapter constructor backed by Firestore via {@link OidcAdapterFirestoreCollections}.
 *
 * All model types are stored in a single collection, discriminated by the `type` field.
 *
 * @example
 * ```ts
 * const adapter = createOidcProviderAdapterFactory(collections);
 * new Provider('issuer', { adapter });
 * ```
 */
export function createOidcProviderAdapterFactory(collections: OidcAdapterFirestoreCollections): OidcProviderAdapterConstructor {
  class FirestoreOidcProviderAdapter implements OidcProviderAdapter {
    private readonly collection: OidcAdapterEntryFirestoreCollection;

    constructor(readonly model: string) {
      this.collection = collections.oidcAdapterEntryCollection;
    }

    async upsert(id: string, payload: OidcAdapterPayload, expiresIn: number): Promise<void> {
      const data: OidcAdapterEntry = {
        ...payload,
        type: this.model,
        ...(expiresIn ? { expiresAt: new Date((epochTime() + expiresIn) * 1000) } : undefined)
      };

      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set(data as any, { merge: true });
    }

    async find(id: string): Promise<OidcAdapterPayload | undefined> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();
      let result: OidcAdapterPayload | undefined;

      if (data && data.type === this.model) {
        result = this._checkExpiration(data);
      }

      return result;
    }

    async findByUserCode(userCode: string): Promise<OidcAdapterPayload | undefined> {
      const results = await this.collection.query(where<OidcAdapterEntry>('type', '==', this.model), where<OidcAdapterEntry>('userCode', '==', userCode)).getDocs();
      let result: OidcAdapterPayload | undefined;

      if (!results.empty) {
        result = this._checkExpiration(results.docs[0].data() as OidcAdapterEntry);
      }

      return result;
    }

    async findByUid(uid: string): Promise<OidcAdapterPayload | undefined> {
      const results = await this.collection.query(where<OidcAdapterEntry>('type', '==', this.model), where<OidcAdapterEntry>('uid', '==', uid)).getDocs();
      let result: OidcAdapterPayload | undefined;

      if (!results.empty) {
        result = this._checkExpiration(results.docs[0].data() as OidcAdapterEntry);
      }

      return result;
    }

    async consume(id: string): Promise<void> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set({ consumed: epochTime() } as Partial<OidcAdapterEntry> as any, { merge: true });
    }

    async destroy(id: string): Promise<void> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.delete();
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      if (!GRANTABLE_MODELS.has(this.model)) {
        return;
      }

      const results = await this.collection.query(where<OidcAdapterEntry>('type', '==', this.model), where<OidcAdapterEntry>('grantId', '==', grantId)).getDocs();

      if (!results.empty) {
        await Promise.all(
          results.docs.map((snapshot) => {
            const doc = this.collection.documentAccessor().loadDocumentForId(snapshot.id);
            return doc.accessor.delete();
          })
        );
      }
    }

    private _checkExpiration(data: OidcAdapterEntry): OidcAdapterPayload | undefined {
      if (data.expiresAt) {
        const expiresDate = data.expiresAt instanceof Date ? data.expiresAt : (data.expiresAt as any).toDate();

        if (expiresDate < new Date()) {
          return undefined;
        }
      }

      return data as unknown as OidcAdapterPayload;
    }
  }

  return FirestoreOidcProviderAdapter as unknown as OidcProviderAdapterConstructor;
}
