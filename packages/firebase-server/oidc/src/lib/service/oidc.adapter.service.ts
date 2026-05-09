import type { Adapter, AdapterConstructor, AdapterPayload } from 'oidc-provider';
import { type OidcServerFirestoreCollections } from '../model';
import { OIDC_ENTRY_CLIENT_TYPE, type OidcEntry, type OidcEntryId, type OidcEntryFirestoreCollection, oidcEntriesByUserCodeQuery, oidcEntriesByUidQuery, oidcEntriesByGrantIdQuery, type FirebaseAuthOwnershipKey } from '@dereekb/firebase';
import { type Maybe, type UnixDateTimeSecondsNumber, unixDateTimeSecondsNumberForNow, unixDateTimeSecondsNumberToDate } from '@dereekb/util';
import { type OidcEncryptionService } from './oidc.encryption.service';
import { safeToJsDate } from '@dereekb/date';

// MARK: Adapter
/**
 * Model types that support grantId-based revocation.
 */
export const GRANTABLE_MODEL_NAMES = ['AccessToken', 'AuthorizationCode', 'RefreshToken', 'DeviceCode', 'BackchannelAuthenticationRequest'] as const;

export type GrantableModelName = (typeof GRANTABLE_MODEL_NAMES)[number];

const GRANTABLE_MODELS: ReadonlySet<string> = new Set(GRANTABLE_MODEL_NAMES);

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
 * @returns an oidc-provider adapter constructor backed by Firestore
 */
export function createAdapterFactory(collections: OidcServerFirestoreCollections, encryptionService: OidcEncryptionService): AdapterConstructor {
  class FirestoreAdapter implements Adapter {
    private readonly collection: OidcEntryFirestoreCollection;

    constructor(readonly name: string) {
      this.collection = collections.oidcEntryCollection;
    }

    async upsert(id: OidcEntryId, payload: AdapterPayload, expiresIn: UnixDateTimeSecondsNumber): Promise<void> {
      // Set ownership key for Client entries so firestore rules can restrict reads by owner.
      // The firestoreOwnerKey is passed through the payload metadata by OidcClientService.
      const o: Maybe<FirebaseAuthOwnershipKey> = this.name === OIDC_ENTRY_CLIENT_TYPE ? (payload.firestoreOwnerKey as string | undefined) : undefined;

      // oidc-provider uses `accountId` as the user identifier on Grant, AccessToken,
      // RefreshToken, etc. — `payload.uid` is only populated on Session/Interaction.
      // Fall back to `accountId` so the indexed `uid` column works for all entry types.
      const uid = (payload.uid as string | undefined) ?? (payload.accountId as string | undefined);

      // oidc-provider stores the OAuth client id as `clientId` on every grantable
      // model (Grant, AccessToken, RefreshToken, AuthorizationCode, DeviceCode, etc.).
      // Client entries themselves use `client_id` in the payload, so we read both.
      const clientId = (payload.clientId as string | undefined) ?? (payload.client_id as string | undefined);

      // Derive a stable `createdAt` from the payload so it survives upserts
      // (e.g. `consume`). Grant/AccessToken/RefreshToken/AuthorizationCode all
      // inherit `iat` (epoch seconds) from BaseToken; Client entries use
      // `created_at` (ISO string).
      const iat = payload.iat as number | undefined;
      const createdAtIso = payload.created_at as string | undefined;
      let createdAt: Maybe<Date>;

      if (typeof iat === 'number') {
        createdAt = unixDateTimeSecondsNumberToDate(iat);
      } else if (createdAtIso) {
        createdAt = safeToJsDate(createdAtIso);
      }

      const data: OidcEntry = {
        type: this.name,
        payload: encryptionService.encryptAdapterPayload(payload),
        o,
        uid,
        grantId: payload.grantId as string | undefined,
        clientId,
        userCode: payload.userCode as string | undefined,
        consumed: payload.consumed as number | undefined,
        ...(createdAt ? { createdAt } : undefined),
        ...(expiresIn ? { expiresAt: unixDateTimeSecondsNumberToDate(unixDateTimeSecondsNumberForNow() + expiresIn) } : undefined)
      };

      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      await doc.accessor.set(data as Partial<OidcEntry>, { merge: true });
    }

    async find(id: OidcEntryId): Promise<AdapterPayload | undefined> {
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();
      return data?.type === this.name ? this._toPayload(data) : undefined;
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcEntriesByUserCodeQuery(this.name, userCode)).getDocs();
      return !results.empty ? this._toPayload(results.docs[0].data()) : undefined;
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
      const results = await this.collection.query(oidcEntriesByUidQuery(this.name, uid)).getDocs();
      return !results.empty ? this._toPayload(results.docs[0].data()) : undefined;
    }

    async consume(id: OidcEntryId): Promise<void> {
      const now = unixDateTimeSecondsNumberForNow();
      const doc = this.collection.documentAccessor().loadDocumentForId(id);
      const snapshot = await doc.accessor.get();
      const data = snapshot.data();

      if (data) {
        const payload = encryptionService.decryptAdapterPayload(data.payload);
        payload.consumed = now;

        await doc.accessor.set({ consumed: now, payload: encryptionService.encryptAdapterPayload(payload) } as Partial<OidcEntry>, { merge: true });
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
     *
     * @param data - the Firestore document data to convert
     * @returns the decrypted adapter payload, or undefined if the entry has expired
     */
    private _toPayload(data: OidcEntry): AdapterPayload | undefined {
      const expiresDate = data.expiresAt ? (data.expiresAt instanceof Date ? data.expiresAt : (data.expiresAt as { toDate(): Date }).toDate()) : undefined;
      const isExpired = expiresDate != null && expiresDate < new Date();
      return isExpired ? undefined : encryptionService.decryptAdapterPayload(data.payload);
    }
  }

  return FirestoreAdapter;
}
