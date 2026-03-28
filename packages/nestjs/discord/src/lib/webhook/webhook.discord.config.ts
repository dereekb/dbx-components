import { isHexWithByteLength } from '@dereekb/util';
import { type DiscordPublicKey } from '../discord.type';

/**
 * Default environment variable for the Discord application public key.
 */
export const DISCORD_PUBLIC_KEY_ENV_VAR = 'DISCORD_PUBLIC_KEY';

/**
 * The byte length of a Discord Ed25519 public key (32 bytes = 64 hex characters).
 */
export const DISCORD_ED25519_PUBLIC_KEY_BYTE_LENGTH = 32;

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
    const publicKey = config.discordWebhook.publicKey;

    if (!publicKey) {
      throw new Error('No Discord public key specified.');
    }

    if (!isHexWithByteLength(publicKey, { byteLength: DISCORD_ED25519_PUBLIC_KEY_BYTE_LENGTH })) {
      throw new Error('Discord public key is not available or is invalid. Expected a 64-character hex string (32-byte Ed25519 key).');
    }
  }
}
