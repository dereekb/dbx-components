import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type KnownUserExternalConnectionProviderType, type UserExternalConnectionProviderType } from '@dereekb/firebase';

/**
 * Provider type for the demo app's Cal.com integration.
 *
 * Aliases the shared constant rather than re-declaring the literal: the string is the map key on
 * BOTH halves of the connection pair, so demo-api's OAuth controller and the settings page must use
 * the same one.
 */
export const DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Zoom integration.
 */
export const DEMO_ZOOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Discord integration.
 */
export const DEMO_DISCORD_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Zoho integration.
 */
export const DEMO_ZOHO_EXTERNAL_CONNECTION_PROVIDER_TYPE: KnownUserExternalConnectionProviderType = ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's ADMIN Zoho integration: a second Zoho connection, separate from
 * {@link DEMO_ZOHO_EXTERNAL_CONNECTION_PROVIDER_TYPE}, that exists only to be minted out to `zoho-cli`.
 *
 * Same Zoho OAuth client, but its own consent with the wider module scopes the CLI needs, its own
 * controller at `/oauth/zoho_admin`, and its own entry in the connection map — so the server's own
 * least-privilege `zoho` connection is never widened to serve the CLI. Admin-only to connect, and the
 * only demo provider whose access token may leave the server (demo-api's provider policy declares
 * `adminOnly` + `tokenExport` for it).
 */
export const DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = 'zoho_admin';
