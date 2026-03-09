import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordApi } from './discord.api';
import { DISCORD_BOT_TOKEN_ENV_VAR, DiscordServiceConfig } from './discord.config';
import { type DiscordBotToken } from './discord.type';

/**
 * Factory that creates a DiscordServiceConfig from environment variables.
 */
export function discordServiceConfigFactory(configService: ConfigService): DiscordServiceConfig {
  const config: DiscordServiceConfig = {
    discord: {
      botToken: configService.get<DiscordBotToken>(DISCORD_BOT_TOKEN_ENV_VAR) as DiscordBotToken,
      autoLogin: true
    }
  };

  DiscordServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the DiscordApi service.
 *
 * Reads the bot token from the DISCORD_BOT_TOKEN environment variable.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DiscordServiceConfig,
      inject: [ConfigService],
      useFactory: discordServiceConfigFactory
    },
    DiscordApi
  ],
  exports: [DiscordApi]
})
export class DiscordModule {}
