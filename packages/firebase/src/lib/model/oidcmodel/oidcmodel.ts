import { type JsonSerializableObject, type Maybe } from '@dereekb/util';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, firestoreModelIdentity, snapshotConverterFunctions, optionalFirestoreDate, optionalFirestoreNumber, optionalFirestoreString, firestoreString, type FirebaseAuthOwnershipKey, firestorePassThroughField } from '../../common';
import { type GrantedDeleteRole, type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';

/**
 * Union of model identity types used in the OIDC function map.
 */
export type OidcModelTypes = typeof oidcEntryIdentity;

/**
 * Abstract class providing access to all oidc-related Firestore collections.
 *
 * Implementations provide concrete collection instances wired to a specific {@link FirestoreContext}.
 * Used by both client and server code to access oidc model documents.
 *
 * @see `OidcModelServerActions` in `@dereekb/firebase-server/oidc` for server-side action processing
 */
export abstract class OidcModelFirestoreCollections {
  abstract readonly oidcEntryCollection: OidcEntryFirestoreCollection;
}

// MARK: Identity
/**
 * Firestore model identity for {@link OidcEntry} documents.
 *
 * Collection name: `oidcEntry`, short code: `oidc_e`.
 */
export const oidcEntryIdentity = firestoreModelIdentity('oidcEntry', 'oidc_e');

// MARK: Adapter Entry Type
/**
 * Known oidc-provider model types stored in the adapter collection.
 *
 * Used as the discriminator in the {@link OidcEntry.type} field.
 */
export type OidcEntryType = 'Session' | 'AccessToken' | 'AuthorizationCode' | 'RefreshToken' | 'DeviceCode' | 'ClientCredentials' | 'Client' | 'InitialAccessToken' | 'RegistrationAccessToken' | 'Interaction' | 'ReplayDetection' | 'PushedAuthorizationRequest' | 'Grant' | 'BackchannelAuthenticationRequest' | (string & {});

/**
 * Type value for Client adapter entries.
 */
export const OIDC_ENTRY_CLIENT_TYPE: OidcEntryType = 'Client';

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
export interface OidcEntry {
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

export type OidcEntryRoles = GrantedReadRole | GrantedUpdateRole | GrantedDeleteRole;

/**
 * Firestore document wrapper for {@link OidcEntry}.
 */
export class OidcEntryDocument extends AbstractFirestoreDocument<OidcEntry, OidcEntryDocument, typeof oidcEntryIdentity> {
  get modelIdentity() {
    return oidcEntryIdentity;
  }
}

// MARK: Converter
/**
 * Firestore snapshot converter for {@link OidcEntry} documents.
 */
export const oidcEntryConverter = snapshotConverterFunctions<OidcEntry>({
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
 * Typed Firestore collection for {@link OidcEntry} documents.
 */
export type OidcEntryFirestoreCollection = FirestoreCollection<OidcEntry, OidcEntryDocument>;

/**
 * Configuration for creating an {@link OidcEntryFirestoreCollection}.
 */
export interface OidcEntryFirestoreCollectionConfig {
  readonly firestoreContext: FirestoreContext;
}

/**
 * Returns the Firestore {@link CollectionReference} for {@link OidcEntry} documents.
 */
export function oidcEntryCollectionReference(context: FirestoreContext): CollectionReference<OidcEntry> {
  return context.collection(oidcEntryIdentity.collectionName);
}

/**
 * Creates an {@link OidcEntryFirestoreCollection} from the given configuration.
 */
export function oidcEntryFirestoreCollection(config: OidcEntryFirestoreCollectionConfig): OidcEntryFirestoreCollection {
  const { firestoreContext } = config;

  return firestoreContext.firestoreCollection({
    modelIdentity: oidcEntryIdentity,
    converter: oidcEntryConverter,
    collection: oidcEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OidcEntryDocument(accessor, documentAccessor),
    firestoreContext
  });
}
