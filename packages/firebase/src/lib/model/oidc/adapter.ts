import { JsonSerializableObject, POJOKey, type Maybe } from '@dereekb/util';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, firestoreModelIdentity, snapshotConverterFunctions, optionalFirestoreDate, optionalFirestoreNumber, optionalFirestoreString, firestoreString, type FirebaseAuthOwnershipKey, firestorePassThroughField } from '../../common';
import { GrantedDeleteRole, GrantedReadRole, GrantedUpdateRole } from '@dereekb/model';

/**
 * Union of model identity types used in the OIDC function map.
 */
export type OidcModelTypes = typeof oidcAdapterEntryIdentity;

/**
 * Abstract base providing access to OIDC adapter Firestore collections.
 *
 * The server-side {@link OidcFirestoreCollections} extends this with additional
 * server-only collections (e.g., JWKS keys).
 */
export abstract class OidcModelFirestoreCollections {
  abstract readonly oidcAdapterEntryCollection: OidcAdapterEntryFirestoreCollection;
}

// MARK: Identity
/**
 * Firestore model identity for {@link OidcAdapterEntry} documents.
 *
 * Collection name: `oidcAdapterEntry`, short code: `oidc_oa`.
 */
export const oidcAdapterEntryIdentity = firestoreModelIdentity('oidcAdapterEntry', 'oidc_oa');

// MARK: Adapter Entry Type
/**
 * Known oidc-provider model types stored in the adapter collection.
 *
 * Used as the discriminator in the {@link OidcAdapterEntry.type} field.
 */
export type OidcAdapterEntryType = 'Session' | 'AccessToken' | 'AuthorizationCode' | 'RefreshToken' | 'DeviceCode' | 'ClientCredentials' | 'Client' | 'InitialAccessToken' | 'RegistrationAccessToken' | 'Interaction' | 'ReplayDetection' | 'PushedAuthorizationRequest' | 'Grant' | 'BackchannelAuthenticationRequest' | (string & {});

/**
 * Type value for Client adapter entries.
 */
export const OIDC_ADAPTER_ENTRY_CLIENT_TYPE: OidcAdapterEntryType = 'Client';

// MARK: Types
/**
 * oidc-provider adapter entry stored in Firestore.
 *
 * All oidc-provider model types (Session, AccessToken, Client, etc.) are stored in a single collection,
 * discriminated by the {@link type} field. The full oidc-provider payload is serialized as JSON in
 * the {@link payload} field. Sensitive fields within the payload (e.g. `client_secret`) may be
 * selectively encrypted at rest.
 *
 * The {@link o} ownership field enables Firestore security rules to restrict reads to the owning user
 * (used primarily for Client entries so users can query their own registered OAuth clients).
 */
export interface OidcAdapterEntry {
  /**
   * The oidc-provider model type (e.g., 'Session', 'AccessToken', 'Client').
   */
  type: string;
  /**
   * Serialized JSON of the full oidc-provider AdapterPayload.
   *
   * The payload structure varies by model type. Sensitive fields may be
   * selectively encrypted (prefixed with `$`) when encryption is configured.
   */
  payload: JsonSerializableObject;
  /**
   * Ownership key for Firestore security rules.
   *
   * Set to the Firebase Auth UID of the user who created this entry.
   * Used primarily on Client entries to allow users to query their own OAuth clients.
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * User identifier. Extracted from the payload for indexed queries.
   */
  uid?: Maybe<string>;
  /**
   * Grant identifier for revocation support. Extracted from the payload for indexed queries.
   */
  grantId?: Maybe<string>;
  /**
   * User code for device flow. Extracted from the payload for indexed queries.
   */
  userCode?: Maybe<string>;
  /**
   * Epoch timestamp when this entry was consumed. Extracted from the payload for indexed queries.
   */
  consumed?: Maybe<number>;
  /**
   * When this entry expires.
   */
  expiresAt?: Maybe<Date>;
}

export type OidcAdapterEntryRoles = GrantedReadRole | GrantedUpdateRole | GrantedDeleteRole;

/**
 * Firestore document wrapper for {@link OidcAdapterEntry}.
 */
export class OidcAdapterEntryDocument extends AbstractFirestoreDocument<OidcAdapterEntry, OidcAdapterEntryDocument, typeof oidcAdapterEntryIdentity> {
  get modelIdentity() {
    return oidcAdapterEntryIdentity;
  }
}

// MARK: Converter
/**
 * Firestore snapshot converter for {@link OidcAdapterEntry} documents.
 */
export const oidcAdapterEntryConverter = snapshotConverterFunctions<OidcAdapterEntry>({
  fields: {
    type: firestoreString({ default: 'unknown' }),
    payload: firestorePassThroughField(),
    o: optionalFirestoreString(),
    uid: optionalFirestoreString(),
    grantId: optionalFirestoreString(),
    userCode: optionalFirestoreString(),
    consumed: optionalFirestoreNumber(),
    expiresAt: optionalFirestoreDate()
  }
});

// MARK: Collection
/**
 * Typed Firestore collection for {@link OidcAdapterEntry} documents.
 */
export type OidcAdapterEntryFirestoreCollection = FirestoreCollection<OidcAdapterEntry, OidcAdapterEntryDocument>;

/**
 * Configuration for creating an {@link OidcAdapterEntryFirestoreCollection}.
 */
export interface OidcAdapterEntryFirestoreCollectionConfig {
  readonly firestoreContext: FirestoreContext;
}

/**
 * Returns the Firestore {@link CollectionReference} for {@link OidcAdapterEntry} documents.
 */
export function oidcAdapterEntryCollectionReference(context: FirestoreContext): CollectionReference<OidcAdapterEntry> {
  return context.collection(oidcAdapterEntryIdentity.collectionName);
}

/**
 * Creates an {@link OidcAdapterEntryFirestoreCollection} from the given configuration.
 */
export function oidcAdapterEntryFirestoreCollection(config: OidcAdapterEntryFirestoreCollectionConfig): OidcAdapterEntryFirestoreCollection {
  const { firestoreContext } = config;

  return firestoreContext.firestoreCollection({
    modelIdentity: oidcAdapterEntryIdentity,
    converter: oidcAdapterEntryConverter,
    collection: oidcAdapterEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OidcAdapterEntryDocument(accessor, documentAccessor),
    firestoreContext
  });
}
