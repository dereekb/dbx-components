import { isTestNodeEnv } from '@dereekb/nestjs';
import { Module, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordApi } from './discord.api';
import { DISCORD_BOT_TOKEN_ENV_VAR, DiscordServiceConfig, isUsableDiscordBotToken } from './discord.config';
import { type DiscordBotToken } from '@dereekb/discord';

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

// MARK: App Discord Module
/**
 * Factory that creates a {@link DiscordServiceConfig} from the app's config service.
 */
export type DiscordServiceConfigFactory = (configService: ConfigService) => DiscordServiceConfig;

export interface ProvideAppDiscordMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional override for the DiscordServiceConfigFactory.
   *
   * An app that only uses the REST api should supply a factory with `autoLogin: false`, so a cold
   * start never opens a gateway websocket it will not use.
   *
   * @default discordServiceConfigFactory
   */
  readonly discordServiceConfigFactory?: DiscordServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's DiscordModule.
 *
 * Mirrors `appDiscordOAuthModuleMetadata`, letting an app supply its own config factory
 * instead of re-declaring the whole provider.
 *
 * @param config - The module metadata configuration including an optional config factory.
 * @returns NestJS ModuleMetadata for registering the DiscordModule.
 */
export function appDiscordModuleMetadata(config: ProvideAppDiscordMetadataConfig): ModuleMetadata {
  const { imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [DiscordApi, ...(exports ?? [])],
    providers: [
      {
        provide: DiscordServiceConfig,
        inject: [ConfigService],
        useFactory: config.discordServiceConfigFactory ?? discordServiceConfigFactory
      },
      DiscordApi,
      ...(providers ?? [])
    ]
  };
}
