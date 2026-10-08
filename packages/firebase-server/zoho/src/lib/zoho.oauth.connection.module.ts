import { type InjectionToken, type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type ZohoAccountsConfigApiUrlInput, type ZohoOAuthScope } from '@dereekb/zoho';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { ZohoUserExternalConnectionOAuthServiceConfig, zohoUserExternalConnectionOAuthServiceConfigFactory } from './zoho.oauth.connection.config';
import { zohoUserExternalConnectionOAuthControllerForProviderType } from './zoho.oauth.connection.controller';
import { ZohoUserExternalConnectionOAuthService } from './zoho.oauth.connection.service';

// MARK: Service Token
/**
 * Returns the injection token a Zoho connection's {@link ZohoUserExternalConnectionOAuthService} is
 * exported under.
 *
 * The default provider type keeps the class token. Any other gets a token of its own: an app registering
 * two Zoho connections imports both modules into the one declaring the OAuth provider registry, and two
 * modules exporting the same class token would leave that registry with only one of them.
 *
 * @param providerType - The provider type of the Zoho connection. Defaults to {@link ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}.
 * @returns The token to list in `userExternalConnectionOAuthProviderRegistryProvider()`.
 */
export function zohoUserExternalConnectionOAuthServiceToken(providerType?: Maybe<UserExternalConnectionProviderType>): InjectionToken {
  const type = providerType ?? ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  return type === ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE ? ZohoUserExternalConnectionOAuthService : `ZohoUserExternalConnectionOAuthService:${type}`;
}

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
   * The provider type this Zoho connection is stored and routed under. Defaults to `zoho`.
   *
   * An app may register several Zoho connections, each its own module with its own provider type,
   * scopes and (through {@link dependencyModule}) OAuth client — e.g. a minimal `zoho` connection the
   * server calls Zoho with, and a full-scope `zoho_admin` connection only ever minted out to a CLI.
   * Each mounts at `/oauth/<providerType>`, and its service is exported under
   * {@link zohoUserExternalConnectionOAuthServiceToken}. Every extra instance needs:
   *
   * - its redirect URI (`<apiUrl>/oauth/<providerType>/callback`) registered with the Zoho OAuth client;
   * - its routes excluded from the app's global route prefix, through
   *   `userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType)` from `@dereekb/firebase-server/model`;
   * - its service token added to the app's `UserExternalConnectionOAuthProviderRegistry` list.
   *
   * Instances share one Zoho OAuth client by default. To use a different client, pass a second module
   * built with `appZohoAccountsOAuthModuleMetadata({ zohoAccountsOAuthServiceConfigFactory })`
   * (`@dereekb/zoho/nestjs`) as this instance's {@link dependencyModule}.
   */
  readonly providerType?: Maybe<UserExternalConnectionProviderType>;
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
  const providerType = config.providerType ?? ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];
  const serviceToken = zohoUserExternalConnectionOAuthServiceToken(providerType);
  // the service is always registered under its class token, which the controller injects; another
  // provider type re-exports it under its own token so it cannot collide with the default connection's
  const serviceAliasProviders: Provider[] = serviceToken === ZohoUserExternalConnectionOAuthService ? [] : [{ provide: serviceToken, useExisting: ZohoUserExternalConnectionOAuthService }];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [zohoUserExternalConnectionOAuthControllerForProviderType(providerType)],
    exports: [serviceToken, ...(exports ?? [])],
    providers: [
      {
        provide: ZohoUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => zohoUserExternalConnectionOAuthServiceConfigFactory({ envService, providerType, successPath, failurePath, scopes, accountsApiUrl })
      },
      ZohoUserExternalConnectionOAuthService,
      ...serviceAliasProviders,
      ...(providers ?? [])
    ]
  };
}
