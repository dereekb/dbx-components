import { type FirestoreModelId, type FirestoreModelKey } from '../../common';

/**
 * Document id for a {@link UserExternalConnection}.
 *
 * The document id IS the user's Firebase Auth uid. There is exactly one document per user.
 */
export type UserExternalConnectionId = FirestoreModelId;

/**
 * Full Firestore model key path for a {@link UserExternalConnection} document.
 */
export type UserExternalConnectionKey = FirestoreModelKey;

/**
 * String identifier for a third-party service a user can connect their account to.
 *
 * Used as the key of the per-provider entry map on a UserExternalConnection, so it must be a
 * valid Firestore map key (no dots or slashes) and must be identical on the server paths that
 * write the connection and the client paths that render it.
 */
export type UserExternalConnectionProviderType = string;

/**
 * Known third-party services the workspace ships provider support for.
 */
export type KnownUserExternalConnectionProviderType = 'calcom' | 'zoom' | 'discord';

/**
 * A capability/scope string granted by a third-party provider (e.g. an OAuth scope).
 */
export type UserExternalConnectionCapability = string;

/**
 * Identifier for the connected account within the third-party provider.
 */
export type UserExternalConnectionExternalAccountId = string;
