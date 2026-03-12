import { type JwksFirestoreCollections, type JwksKeyFirestoreCollection } from './jwks';
import { type OidcModelFirestoreCollections, type OidcEntryFirestoreCollection } from '@dereekb/firebase';

// MARK: Collections
/**
 * Abstract class providing access to all OIDC-related Firestore collections.
 *
 * Extends both {@link JwksFirestoreCollections} (server-only JWKS keys) and
 * {@link OidcModelFirestoreCollections} (shared adapter entries).
 */
export abstract class OidcServerFirestoreCollections implements JwksFirestoreCollections, OidcModelFirestoreCollections {
  abstract readonly jwksKeyCollection: JwksKeyFirestoreCollection;
  abstract readonly oidcEntryCollection: OidcEntryFirestoreCollection;
}
