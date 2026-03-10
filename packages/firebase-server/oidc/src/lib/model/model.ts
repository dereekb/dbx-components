import { type JwksKeyFirestoreCollection } from './jwks';
import { type OidcAdapterEntryFirestoreCollection } from './adapter';

// MARK: Collections
/**
 * Abstract class providing access to all OIDC-related Firestore collections.
 */
export abstract class OidcFirestoreCollections {
  abstract readonly jwksKeyCollection: JwksKeyFirestoreCollection;
  abstract readonly oidcAdapterEntryCollection: OidcAdapterEntryFirestoreCollection;
}
