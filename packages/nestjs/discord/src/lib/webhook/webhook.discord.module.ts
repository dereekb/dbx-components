import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordWebhookController } from './webhook.discord.controller';
import { DiscordWebhookService } from './webhook.discord.service';
import { DISCORD_PUBLIC_KEY_ENV_VAR, DiscordWebhookServiceConfig } from './webhook.discord.config';
import { type DiscordPublicKey } from '../discord.type';

/**
 * Factory that creates a DiscordWebhookServiceConfig from environment variables.
 */
export function discordWebhookServiceConfigFactory(configService: ConfigService): DiscordWebhookServiceConfig {
  const config: DiscordWebhookServiceConfig = {
    discordWebhook: {
      publicKey: configService.get<DiscordPublicKey>(DISCORD_PUBLIC_KEY_ENV_VAR) as DiscordPublicKey
    }
  };

  DiscordWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides Discord interaction webhook handling.
 *
 * Standalone — does not depend on DiscordModule (no bot token needed).
 * Reads the application public key from the DISCORD_PUBLIC_KEY environment variable.
 */
@Module({
  imports: [ConfigModule],
  controllers: [DiscordWebhookController],
  providers: [
    {
      provide: DiscordWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: discordWebhookServiceConfigFactory
    },
    DiscordWebhookService
  ],
  exports: [DiscordWebhookService]
})
export class DiscordWebhookModule {}
