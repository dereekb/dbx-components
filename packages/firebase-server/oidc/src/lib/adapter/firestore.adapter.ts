import { type Firestore } from 'firebase-admin/firestore';

// MARK: Types
/**
 * oidc-provider Adapter interface.
 *
 * Each adapter instance is created per model type (e.g., 'Session', 'AccessToken', etc.)
 */
export interface OidcAdapter {
  upsert(id: string, payload: OidcAdapterPayload, expiresIn: number): Promise<void>;
  find(id: string): Promise<OidcAdapterPayload | undefined>;
  findByUserCode(userCode: string): Promise<OidcAdapterPayload | undefined>;
  findByUid(uid: string): Promise<OidcAdapterPayload | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}

export interface OidcAdapterConstructor {
  new (name: string): OidcAdapter;
}

export interface OidcAdapterPayload {
  uid?: string;
  grantId?: string;
  userCode?: string;
  consumed?: number;
  [key: string]: unknown;
}

// MARK: Config
export interface FirestoreOidcAdapterConfig {
  /**
   * Firestore instance to use.
   */
  firestore: Firestore;
  /**
   * Prefix for collection names. Defaults to 'oidc_'.
   */
  collectionPrefix?: string;
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
 * Creates a Firestore-backed adapter constructor for oidc-provider.
 *
 * Usage:
 * ```ts
 * const adapter = createFirestoreOidcAdapterFactory({ firestore });
 * new Provider('issuer', { adapter });
 * ```
 */
export function createFirestoreOidcAdapterFactory(config: FirestoreOidcAdapterConfig): OidcAdapterConstructor {
  const { firestore, collectionPrefix = 'oidc_' } = config;

  class FirestoreOidcAdapter implements OidcAdapter {
    readonly collectionName: string;

    constructor(readonly model: string) {
      this.collectionName = `${collectionPrefix}${model.toLowerCase()}s`;
    }

    private get collection() {
      return firestore.collection(this.collectionName);
    }

    private doc(id: string) {
      return this.collection.doc(id);
    }

    async upsert(id: string, payload: OidcAdapterPayload, expiresIn: number): Promise<void> {
      const doc: Record<string, unknown> = {
        ...payload,
        ...(expiresIn ? { expiresAt: new Date((epochTime() + expiresIn) * 1000) } : undefined)
      };

      await this.doc(id).set(doc, { merge: true });
    }

    async find(id: string): Promise<OidcAdapterPayload | undefined> {
      const snapshot = await this.doc(id).get();

      if (!snapshot.exists) {
        return undefined;
      }

      const data = snapshot.data() as OidcAdapterPayload & { expiresAt?: Date | { toDate(): Date } };

      if (data.expiresAt) {
        const expiresDate = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt.toDate();

        if (expiresDate < new Date()) {
          return undefined;
        }
      }

      return data;
    }

    async findByUserCode(userCode: string): Promise<OidcAdapterPayload | undefined> {
      const results = await this.collection.where('userCode', '==', userCode).limit(1).get();

      if (results.empty) {
        return undefined;
      }

      return this._resultFromSnapshot(results.docs[0]);
    }

    async findByUid(uid: string): Promise<OidcAdapterPayload | undefined> {
      const results = await this.collection.where('uid', '==', uid).limit(1).get();

      if (results.empty) {
        return undefined;
      }

      return this._resultFromSnapshot(results.docs[0]);
    }

    async consume(id: string): Promise<void> {
      await this.doc(id).update({ consumed: epochTime() });
    }

    async destroy(id: string): Promise<void> {
      await this.doc(id).delete();
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      if (!GRANTABLE_MODELS.has(this.model)) {
        return;
      }

      const results = await this.collection.where('grantId', '==', grantId).get();

      if (results.empty) {
        return;
      }

      const batch = firestore.batch();
      results.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    private _resultFromSnapshot(snapshot: FirebaseFirestore.QueryDocumentSnapshot): OidcAdapterPayload | undefined {
      const data = snapshot.data() as OidcAdapterPayload & { expiresAt?: Date | { toDate(): Date } };

      if (data.expiresAt) {
        const expiresDate = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt.toDate();

        if (expiresDate < new Date()) {
          return undefined;
        }
      }

      return data;
    }
  }

  return FirestoreOidcAdapter as unknown as OidcAdapterConstructor;
}
