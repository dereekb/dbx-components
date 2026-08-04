import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type DiscordOAuthScope } from '@dereekb/discord';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { DiscordUserExternalConnectionOAuthServiceConfig, discordUserExternalConnectionOAuthServiceConfigFactory } from './discord.oauth.connection.config';
import { DiscordUserExternalConnectionOAuthController } from './discord.oauth.connection.controller';
import { DiscordUserExternalConnectionOAuthService } from './discord.oauth.connection.service';

// MARK: App Discord UserExternalConnection OAuth Module
export interface ProvideAppDiscordUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * This module requires the following dependencies in order to initialize properly:
   * - DiscordOAuthApi
   *
   * This module declaration makes it easier to import a module that exports that dependency.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
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
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Discord external-connection
 * OAuth module.
 *
 * Opt-in, like the webhook module: importing the Discord OAuth module alone never mounts HTTP routes,
 * so an app that only runs a Discord bot exposes no connect endpoints.
 *
 * The importing module must also supply `UserExternalConnectionServerActions` and
 * `UserExternalConnectionStateCoder` — both exported by `appUserExternalConnectionModuleMetadata`,
 * so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Discord connect endpoints.
 */
export function appDiscordUserExternalConnectionOAuthModuleMetadata(config: ProvideAppDiscordUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, successPath, failurePath, scopes, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [DiscordUserExternalConnectionOAuthController],
    exports: [DiscordUserExternalConnectionOAuthService, ...(exports ?? [])],
    providers: [
      {
        provide: DiscordUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => discordUserExternalConnectionOAuthServiceConfigFactory({ envService, successPath, failurePath, scopes })
      },
      DiscordUserExternalConnectionOAuthService,
      ...(providers ?? [])
    ]
  };
}
