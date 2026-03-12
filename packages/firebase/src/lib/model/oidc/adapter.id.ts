import { type FirestoreModelId, type FirestoreModelKey } from '../../common';

/**
 * Document ID for an OidcAdapterEntry.
 *
 * The ID is assigned by the oidc-provider library and varies by model type
 * (e.g., opaque token string for AccessToken, random string for Session).
 */
export type OidcAdapterEntryId = FirestoreModelId;

/**
 * Full Firestore model key path for an OidcAdapterEntry document.
 */
export type OidcAdapterEntryKey = FirestoreModelKey;
