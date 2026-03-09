/**
 * Bot token used to authenticate the Discord bot with the gateway.
 */
export type DiscordBotToken = string;

/**
 * A Discord channel ID (snowflake string).
 */
export type DiscordChannelId = string;

/**
 * A Discord guild (server) ID (snowflake string).
 */
export type DiscordGuildId = string;

/**
 * A Discord message snowflake ID string.
 */
export type DiscordMessageId = string;

/**
 * The Ed25519 public key of your Discord application, used to verify interaction webhooks.
 *
 * Found in the Discord Developer Portal under your application's General Information page.
 */
export type DiscordPublicKey = string;
