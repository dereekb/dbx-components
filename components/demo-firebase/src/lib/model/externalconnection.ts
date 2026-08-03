import { type UserExternalConnectionProviderType } from '@dereekb/firebase';

/**
 * Provider type for the demo app's Cal.com integration.
 *
 * Lives here rather than in the Angular app because the string is the map key on BOTH halves of the
 * connection pair: demo-api's OAuth controller writes it, and the settings page renders from it.
 * They must be identical.
 */
export const DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = 'calcom';

/**
 * Provider type for the demo app's Zoom integration.
 */
export const DEMO_ZOOM_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = 'zoom';

/**
 * Provider type for the demo app's Discord integration.
 */
export const DEMO_DISCORD_EXTERNAL_CONNECTION_PROVIDER_TYPE: UserExternalConnectionProviderType = 'discord';
