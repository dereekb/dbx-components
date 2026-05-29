import { isTestNodeEnv } from '@dereekb/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordApi } from './discord.api';
import { DISCORD_BOT_TOKEN_ENV_VAR, DiscordServiceConfig, isUsableDiscordBotToken } from './discord.config';
import { type DiscordBotToken } from './discord.type';

/**
 * Factory that creates a DiscordServiceConfig from environment variables.
 *
 * autoLogin is enabled only when a real bot token is configured and the process is not running
 * under a test environment, so development and CI runs (which use a placeholder token) never
 * attempt a real gateway login that would fail.
 *
 * @param configService - The NestJS config service used to read Discord environment variables.
 * @returns A validated DiscordServiceConfig populated from environment variables.
 */
export function discordServiceConfigFactory(configService: ConfigService): DiscordServiceConfig {
  const botToken = configService.get<DiscordBotToken>(DISCORD_BOT_TOKEN_ENV_VAR) as DiscordBotToken;
  const config: DiscordServiceConfig = {
    discord: {
      botToken,
      autoLogin: isUsableDiscordBotToken(botToken) && !isTestNodeEnv()
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
