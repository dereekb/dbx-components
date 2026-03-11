import type { Adapter, AdapterConstructor, AdapterPayload } from 'oidc-provider';
import { OidcAdapterFirestoreCollections, type OidcAdapterEntry, type OidcAdapterEntryId, type OidcAdapterEntryFirestoreCollection, oidcAdapterEntriesByUserCodeQuery, oidcAdapterEntriesByUidQuery, oidcAdapterEntriesByGrantIdQuery } from '../model/adapter';
import { type UnixDateTimeSecondsNumber, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberToDate } from '@dereekb/util';

// MARK: Adapter
/**
 * Model types that support grantId-based revocation.
 */
const GRANTABLE_MODELS = new Set(['AccessToken', 'AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);

/**
 * Creates an oidc-provider adapter constructor backed by Firestore via {@link OidcAdapterFirestoreCollections}.
 *
 * All model types are stored in a single collection, discriminated by the `type` field.
 *
 * @example
 * ```ts
 * const adapter = createAdapterFactory(collections);
 * new Provider('issuer', { adapter });
 * ```
 */
export function createAdapterFactory(collections: OidcAdapterFirestoreCollections): AdapterConstructor {
  class FirestoreAdapter implements Adapter {
    private readonly collection: OidcAdapterEntryFirestoreCollection;

    constructor(readonly name: string) {
      this.collection = collections.oidcAdapterEntryCollection;
    }

    async upsert(id: OidcAdapterEntryId, payload: AdapterPayload, expiresIn: UnixDateTimeSecondsNumber): Promise<void> {
      const data: OidcAdapterEntry = {
        ...payload,
        type: this.name,
        ...(expiresIn ? { expiresAt: unixDateTimeSecondsNumberToDate(unixDateTimeSecondsNumberForNow() + expiresIn) } : undefined)
      };

      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set(data as any, { merge: true });
    }

    async find(id: OidcAdapterEntryId): Promise<AdapterPayload | undefined> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();
      let result: AdapterPayload | undefined;

      if (data && data.type === this.name) {
        result = this._checkExpiration(data);
      }

      return result;
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcAdapterEntriesByUserCodeQuery(this.name, userCode)).getDocs();
      let result: AdapterPayload | undefined;

      if (!results.empty) {
        result = this._checkExpiration(results.docs[0].data() as OidcAdapterEntry);
      }

      return result;
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcAdapterEntriesByUidQuery(this.name, uid)).getDocs();
      let result: AdapterPayload | undefined;

      if (!results.empty) {
        result = this._checkExpiration(results.docs[0].data() as OidcAdapterEntry);
      }

      return result;
    }

    async consume(id: OidcAdapterEntryId): Promise<void> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set({ consumed: unixDateTimeSecondsNumberForNow() } as Partial<OidcAdapterEntry> as any, { merge: true });
    }

    async destroy(id: OidcAdapterEntryId): Promise<void> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.delete();
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      if (GRANTABLE_MODELS.has(this.name)) {
        const results = await this.collection.query(oidcAdapterEntriesByGrantIdQuery(this.name, grantId)).getDocs();

        if (!results.empty) {
          await Promise.all(
            results.docs.map((snapshot) => {
              const doc = this.collection.documentAccessor().loadDocumentForId(snapshot.id);
              return doc.accessor.delete();
            })
          );
        }
      }
    }

    private _checkExpiration(data: OidcAdapterEntry): AdapterPayload | undefined {
      let result: AdapterPayload | undefined;

      if (data.expiresAt) {
        const expiresDate = data.expiresAt instanceof Date ? data.expiresAt : (data.expiresAt as any).toDate();

        if (expiresDate >= new Date()) {
          result = data as unknown as AdapterPayload;
        }
      } else {
        result = data as unknown as AdapterPayload;
      }

      return result;
    }
  }

  return FirestoreAdapter;
}
