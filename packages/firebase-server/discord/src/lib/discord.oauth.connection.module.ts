import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type DiscordOAuthFactoryConfig, type DiscordOAuthScope } from '@dereekb/discord';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { DiscordUserExternalConnectionOAuthServiceConfig, discordUserExternalConnectionOAuthServiceConfigFactory } from './discord.oauth.connection.config';
import { DiscordUserExternalConnectionOAuthController } from './discord.oauth.connection.controller';
import { DiscordUserExternalConnectionOAuthService } from './discord.oauth.connection.service';

// MARK: App Discord UserExternalConnection OAuth Module
export interface ProvideAppDiscordUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Path on the app URL the user is returned to after connecting, e.g. `/app/settings`.
   */
  readonly successPath: string;
  /**
   * Path on the app URL the user is returned to after a failed connect. Defaults to `successPath`.
   */
  readonly failurePath?: Maybe<string>;
  /**
   * The scopes to request. Defaults to `DEFAULT_DISCORD_OAUTH_SCOPES`.
   */
  readonly scopes?: Maybe<readonly DiscordOAuthScope[]>;
  /**
   * Optional configuration for the Discord OAuth client the service builds — a custom fetch handler
   * or error logger.
   */
  readonly factoryConfig?: Maybe<DiscordOAuthFactoryConfig>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Discord external-connection
 * OAuth module.
 *
 * Takes no `dependencyModule`, unlike the Cal.com equivalent: there is no Discord OAuth NestJS module
 * to depend on, since the connect flow needs no access-token cache and the client is constructed from
 * this module's own config.
 *
 * The importing module must also supply `UserExternalConnectionServerActions` and
 * `UserExternalConnectionStateCoder` — both exported by `appUserExternalConnectionModuleMetadata`,
 * so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Discord connect endpoints.
 */
export function appDiscordUserExternalConnectionOAuthModuleMetadata(config: ProvideAppDiscordUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { successPath, failurePath, scopes, factoryConfig, imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    controllers: [DiscordUserExternalConnectionOAuthController],
    exports: [DiscordUserExternalConnectionOAuthService, ...(exports ?? [])],
    providers: [
      {
        provide: DiscordUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService, ConfigService],
        useFactory: (envService: FirebaseServerEnvService, configService: ConfigService) => discordUserExternalConnectionOAuthServiceConfigFactory({ envService, configService, successPath, failurePath, scopes, factoryConfig })
      },
      DiscordUserExternalConnectionOAuthService,
      ...(providers ?? [])
    ]
  };
}
