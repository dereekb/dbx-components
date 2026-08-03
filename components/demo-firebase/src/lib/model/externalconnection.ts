import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';

/**
 * Provider type for the demo app's Cal.com integration.
 *
 * Aliases the shared constant rather than re-declaring the literal: the string is the map key on
 * BOTH halves of the connection pair, so demo-api's OAuth controller and the settings page must use
 * the same one.
 */
export const DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Zoom integration.
 */
export const DEMO_ZOOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Discord integration.
 */
export const DEMO_DISCORD_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;

/**
 * Provider type for the demo app's Zoho integration.
 */
export const DEMO_ZOHO_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
