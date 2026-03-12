import type { Adapter, AdapterConstructor, AdapterPayload } from 'oidc-provider';
import { OidcServerFirestoreCollections } from '../model';
import { OIDC_ENTRY_CLIENT_TYPE, type OidcEntry, type OidcEntryId, type OidcEntryFirestoreCollection, oidcEntriesByUserCodeQuery, oidcEntriesByUidQuery, oidcEntriesByGrantIdQuery } from '@dereekb/firebase';
import { type UnixDateTimeSecondsNumber, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberToDate } from '@dereekb/util';
import { OidcEncryptionService } from './encryption.service';

// MARK: Adapter
/**
 * Model types that support grantId-based revocation.
 */
const GRANTABLE_MODELS = new Set(['AccessToken', 'AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest']);

/**
 * Creates an oidc-provider adapter constructor backed by Firestore via {@link OidcServerFirestoreCollections}.
 *
 * All model types are stored in a single collection, discriminated by the `type` field.
 * Sensitive payload fields (`client_secret`, `registration_access_token`) are selectively
 * encrypted via the {@link OidcEncryptionService}.
 *
 * @example
 * ```ts
 * const adapter = createAdapterFactory(collections, encryptionService);
 * new Provider('issuer', { adapter });
 * ```
 *
 * @param collections - Firestore collection access for adapter entries.
 * @param encryptionService - Encryption service for sensitive payload fields.
 */
export function createAdapterFactory(collections: OidcServerFirestoreCollections, encryptionService: OidcEncryptionService): AdapterConstructor {
  class FirestoreAdapter implements Adapter {
    private readonly collection: OidcEntryFirestoreCollection;

    constructor(readonly name: string) {
      this.collection = collections.oidcEntryCollection;
    }

    async upsert(id: OidcEntryId, payload: AdapterPayload, expiresIn: UnixDateTimeSecondsNumber): Promise<void> {
      const data: OidcEntry = {
        type: this.name,
        payload: encryptionService.encryptAdapterPayload(payload),
        // Set ownership key for Client entries so firestore rules can restrict reads by owner.
        o: this.name === OIDC_ENTRY_CLIENT_TYPE ? (payload.uid as string | undefined) : undefined,
        uid: payload.uid as string | undefined,
        grantId: payload.grantId as string | undefined,
        userCode: payload.userCode as string | undefined,
        consumed: payload.consumed as number | undefined,
        ...(expiresIn ? { expiresAt: unixDateTimeSecondsNumberToDate(unixDateTimeSecondsNumberForNow() + expiresIn) } : undefined)
      };

      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set(data as any, { merge: true });
    }

    async find(id: OidcEntryId): Promise<AdapterPayload | undefined> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();

      if (data && data.type === this.name) {
        return this._toPayload(data);
      }

      return undefined;
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcEntriesByUserCodeQuery(this.name, userCode)).getDocs();

      if (!results.empty) {
        return this._toPayload(results.docs[0].data() as OidcEntry);
      }

      return undefined;
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcEntriesByUidQuery(this.name, uid)).getDocs();

      if (!results.empty) {
        return this._toPayload(results.docs[0].data() as OidcEntry);
      }

      return undefined;
    }

    async consume(id: OidcEntryId): Promise<void> {
      const now = unixDateTimeSecondsNumberForNow();
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();

      if (data) {
        const payload = encryptionService.decryptAdapterPayload(data.payload);
        payload.consumed = now;

        await doc.accessor.set({ consumed: now, payload: encryptionService.encryptAdapterPayload(payload) } as Partial<OidcEntry> as any, { merge: true });
      }
    }

    async destroy(id: OidcEntryId): Promise<void> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.delete();
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      if (GRANTABLE_MODELS.has(this.name)) {
        const results = await this.collection.query(oidcEntriesByGrantIdQuery(this.name, grantId)).getDocs();

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

    /**
     * Converts a Firestore document into an oidc-provider payload,
     * returning `undefined` if the entry has expired.
     */
    private _toPayload(data: OidcEntry): AdapterPayload | undefined {
      if (data.expiresAt) {
        const expiresDate = data.expiresAt instanceof Date ? data.expiresAt : (data.expiresAt as any).toDate();

        if (expiresDate < new Date()) {
          return undefined;
        }
      }

      return encryptionService.decryptAdapterPayload(data.payload);
    }
  }

  return FirestoreAdapter;
}
