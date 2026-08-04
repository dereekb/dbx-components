/**
 * OAuth2 client id of a Discord application.
 *
 * Identical to the value the developer portal labels "Application ID".
 */
export type DiscordOAuthClientId = string;

/**
 * OAuth2 client secret of a Discord application.
 */
export type DiscordOAuthClientSecret = string;

/**
 * The Discord REST API base, pinned to a version.
 *
 * Endpoint paths are appended to this base, so it intentionally carries no endpoint segment of its
 * own. Discord requires an explicit version in the path; an unversioned base resolves to the oldest
 * still-supported version.
 */
export const DISCORD_API_URL = 'https://discord.com/api/v10';

export type DiscordApiUrl = typeof DISCORD_API_URL;
