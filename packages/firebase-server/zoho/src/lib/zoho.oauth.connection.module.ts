import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type ZohoAccountsConfigApiUrlInput, type ZohoOAuthScope } from '@dereekb/zoho';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { ZohoUserExternalConnectionOAuthServiceConfig, zohoUserExternalConnectionOAuthServiceConfigFactory } from './zoho.oauth.connection.config';
import { ZohoUserExternalConnectionOAuthController } from './zoho.oauth.connection.controller';
import { ZohoUserExternalConnectionOAuthService } from './zoho.oauth.connection.service';

// MARK: App Zoho UserExternalConnection OAuth Module
export interface ProvideAppZohoUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * This module requires the following dependencies in order to initialize properly:
   * - ZohoAccountsOAuthApi
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
   * The scopes to request. Defaults to `DEFAULT_ZOHO_OAUTH_SCOPES`.
   */
  readonly scopes?: Maybe<readonly ZohoOAuthScope[]>;
  /**
   * Datacenter to authorize against. Defaults to the api's configured one.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Zoho external-connection OAuth
 * module.
 *
 * Opt-in: importing the Zoho OAuth module alone never mounts HTTP routes, so an app that only makes
 * outbound Zoho calls exposes no endpoints.
 *
 * The importing module must also supply `UserExternalConnectionServerActions` and
 * `UserExternalConnectionStateCoder` — both exported by `appUserExternalConnectionModuleMetadata`,
 * so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Zoho connect endpoints.
 */
export function appZohoUserExternalConnectionOAuthModuleMetadata(config: ProvideAppZohoUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, successPath, failurePath, scopes, accountsApiUrl, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [ZohoUserExternalConnectionOAuthController],
    exports: [ZohoUserExternalConnectionOAuthService, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => zohoUserExternalConnectionOAuthServiceConfigFactory({ envService, successPath, failurePath, scopes, accountsApiUrl })
      },
      ZohoUserExternalConnectionOAuthService,
      ...(providers ?? [])
    ]
  };
}
