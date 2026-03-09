import { type DiscordPublicKey } from '../discord.type';

/**
 * Default environment variable for the Discord application public key.
 */
export const DISCORD_PUBLIC_KEY_ENV_VAR = 'DISCORD_PUBLIC_KEY';

export interface DiscordWebhookConfig {
  /**
   * The Ed25519 public key used to verify incoming interaction webhook signatures.
   */
  readonly publicKey: DiscordPublicKey;
}

/**
 * Configuration for the DiscordWebhookService.
 */
export abstract class DiscordWebhookServiceConfig {
  readonly discordWebhook!: DiscordWebhookConfig;

  static assertValidConfig(config: DiscordWebhookServiceConfig) {
    if (!config.discordWebhook.publicKey) {
      throw new Error('No Discord public key specified.');
    }
  }
}
