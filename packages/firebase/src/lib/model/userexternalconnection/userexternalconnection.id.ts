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
export type KnownUserExternalConnectionProviderType = 'calcom' | 'zoom' | 'discord' | 'zoho';

/**
 * Provider type for Cal.com.
 *
 * Declared here rather than in a server package because the string is the map key on BOTH halves of
 * the connection pair: the server's OAuth controller writes it and the client renders from it, so
 * they must be the same literal.
 */
export const CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = 'calcom';

/**
 * Provider type for Zoom.
 */
export const ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = 'zoom';

/**
 * Provider type for Discord.
 */
export const DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = 'discord';

/**
 * Provider type for Zoho.
 */
export const ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = 'zoho';

/**
 * A capability/scope string granted by a third-party provider (e.g. an OAuth scope).
 */
export type UserExternalConnectionCapability = string;

/**
 * Identifier for the connected account within the third-party provider.
 */
export type UserExternalConnectionExternalAccountId = string;

/**
 * The delimiter joining a provider type to an external account id in a
 * {@link UserExternalConnectionExternalAccountKey}.
 *
 * A colon is safe on both sides: {@link UserExternalConnectionProviderType} must already be a valid
 * Firestore map key (no dots or slashes), and the key is only ever a stored/queried string VALUE,
 * never a document id or field path.
 */
export const USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_KEY_DELIMITER = ':';

/**
 * A `<providerType>:<externalAccountId>` pair identifying one third-party account globally.
 *
 * The provider type is part of the key because an external account id is only unique WITHIN a
 * provider — a Discord snowflake and a Zoom user id could collide as bare strings.
 */
export type UserExternalConnectionExternalAccountKey = string;

export interface UserExternalConnectionExternalAccountKeyInput {
  readonly providerType: UserExternalConnectionProviderType;
  readonly externalAccountId: UserExternalConnectionExternalAccountId;
}

/**
 * Builds the {@link UserExternalConnectionExternalAccountKey} for a provider/account pair.
 *
 * The SOLE producer of the key format: the derivation that stores it and the query that reads it
 * both go through here, so the two can never disagree about the delimiter.
 *
 * @param input - The provider type and external account id to join.
 * @param input.providerType - The provider the account belongs to.
 * @param input.externalAccountId - The provider's stable id for the account.
 * @returns The external account key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionExternalAccountKey(input: UserExternalConnectionExternalAccountKeyInput): UserExternalConnectionExternalAccountKey {
  return `${input.providerType}${USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_KEY_DELIMITER}${input.externalAccountId}`;
}
