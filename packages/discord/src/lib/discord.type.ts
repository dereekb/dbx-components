/**
 * A Discord snowflake id.
 *
 * The canonical id type for this package, declared in the fetch-only core so both entry points can
 * share one declaration. `@dereekb/discord/nestjs` imports these from here directly rather than
 * re-exporting them (the `dereekb-util/no-sister-re-export` rule), so the dependency only ever points
 * core -> nestjs: the core stays free of discord.js and of anything that asserts a bot token.
 */
export type DiscordSnowflake = string;

/**
 * A Discord snowflake id, when the kind of object it identifies is not significant.
 *
 * Prefer the specific alias ({@link DiscordChannelId}, {@link DiscordGuildId},
 * {@link DiscordMessageId}) where one applies.
 */
export type DiscordId = DiscordSnowflake;

/**
 * A Discord channel id.
 */
export type DiscordChannelId = DiscordSnowflake;

/**
 * A Discord guild (server) id.
 */
export type DiscordGuildId = DiscordSnowflake;

/**
 * A Discord message id.
 */
export type DiscordMessageId = DiscordSnowflake;

/**
 * A Discord user id.
 */
export type DiscordUserId = DiscordSnowflake;

/**
 * Bot token used to authenticate the Discord bot with the gateway.
 *
 * Declared here alongside the other scalars for one place to look, though only
 * `@dereekb/discord/nestjs` consumes it — the core never authenticates as a bot.
 */
export type DiscordBotToken = string;

/**
 * The Ed25519 public key of your Discord application, used to verify interaction webhooks.
 *
 * Found in the Discord Developer Portal under your application's General Information page.
 */
export type DiscordPublicKey = string;
