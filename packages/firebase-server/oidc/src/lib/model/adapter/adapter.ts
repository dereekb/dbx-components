import { type Maybe } from '@dereekb/util';
import { AbstractFirestoreDocument, type FirestoreCollection, type FirestoreContext, type CollectionReference, firestoreModelIdentity, snapshotConverterFunctions, optionalFirestoreDate, optionalFirestoreNumber, optionalFirestoreString, firestoreString } from '@dereekb/firebase';

// MARK: Collections
/**
 * Abstract class providing access to the OIDC adapter Firestore collection.
 */
export abstract class OidcAdapterFirestoreCollections {
  abstract readonly oidcAdapterEntryCollection: OidcAdapterEntryFirestoreCollection;
}

// MARK: Identity
/**
 * Firestore model identity for {@link OidcAdapterEntry} documents.
 */
export const oidcAdapterEntryIdentity = firestoreModelIdentity('oidcAdapterEntry', 'oidc_oa');

// MARK: Types
/**
 * oidc-provider adapter entry stored in Firestore.
 *
 * All oidc-provider model types (Session, AccessToken, etc.) are stored in a single collection,
 * discriminated by the {@link type} field.
 */
export interface OidcAdapterEntry {
  /**
   * The oidc-provider model type (e.g., 'Session', 'AccessToken', 'AuthorizationCode').
   */
  type: string;
  /**
   * User identifier.
   */
  uid?: Maybe<string>;
  /**
   * Grant identifier for revocation support.
   */
  grantId?: Maybe<string>;
  /**
   * User code for device flow.
   */
  userCode?: Maybe<string>;
  /**
   * Epoch timestamp when this entry was consumed.
   */
  consumed?: Maybe<number>;
  /**
   * When this entry expires.
   */
  expiresAt?: Maybe<Date>;
}

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
    type: firestoreString({ default: '' }),
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
