import { type FirestoreModelId, type FirestoreModelKey } from '../../common';

/**
 * Document ID for an OidcEntry.
 *
 * The ID is assigned by the oidc-provider library and varies by model type
 * (e.g., opaque token string for AccessToken, random string for Session).
 */
export type OidcEntryId = FirestoreModelId;

/**
 * Full Firestore model key path for an OidcEntry document.
 */
export type OidcEntryKey = FirestoreModelKey;

/**
 * Unique client identifier for an OIDC client registration.
 */
export type OidcEntryClientId = string;
