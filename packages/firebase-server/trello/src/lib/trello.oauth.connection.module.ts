import { type InjectionToken, type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { type TrelloOAuthScope } from '@dereekb/trello';
import { TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { userExternalConnectionOAuthServiceTokenForProviderType } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { TrelloUserExternalConnectionOAuthServiceConfig, trelloUserExternalConnectionOAuthServiceConfigFactory } from './trello.oauth.connection.config';
import { trelloUserExternalConnectionOAuthControllerForProviderType } from './trello.oauth.connection.controller';
import { TrelloUserExternalConnectionOAuthService } from './trello.oauth.connection.service';

// MARK: Service Token
/**
 * Returns the injection token a Trello connection's {@link TrelloUserExternalConnectionOAuthService} is
 * exported under.
 *
 * The default provider type keeps the class token. Any other gets a token of its own, so two Trello
 * connections imported into the module declaring the OAuth provider registry do not collide.
 *
 * @param providerType - The provider type of the Trello connection. Defaults to {@link TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}.
 * @returns The token to list in `userExternalConnectionOAuthProviderRegistryProvider()`.
 */
export function trelloUserExternalConnectionOAuthServiceToken(providerType?: Maybe<UserExternalConnectionProviderType>): InjectionToken {
  return userExternalConnectionOAuthServiceTokenForProviderType({ providerType, defaultProviderType: TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, serviceClass: TrelloUserExternalConnectionOAuthService, tokenPrefix: 'TrelloUserExternalConnectionOAuthService' });
}

// MARK: App Trello UserExternalConnection OAuth Module
export interface ProvideAppTrelloUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * This module requires the following dependencies in order to initialize properly:
   * - TrelloOAuthApi
   *
   * This module declaration makes it easier to import a module that exports that dependency.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * The provider type this Trello connection is stored and routed under. Defaults to `trello`.
   *
   * An app may register several Trello connections, each its own module with its own provider type and
   * scopes — e.g. a member's own `trello` connection and a `trello_bot` connection to the account a bot
   * acts as. Each mounts at `/oauth/<providerType>`, and its service is exported under
   * {@link trelloUserExternalConnectionOAuthServiceToken}. Every extra instance needs:
   *
   * - its callback URL (`<apiUrl>/oauth/<providerType>/callback`) registered on the Trello OAuth 2.0 client;
   * - its routes excluded from the app's global route prefix, through
   *   `userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType)` from `@dereekb/firebase-server/model`;
   * - its service token added to the app's `UserExternalConnectionOAuthProviderRegistry` list.
   *
   * Instances share one Trello OAuth client by default. To use a different client, pass a second module
   * built with `appTrelloOAuthModuleMetadata({ trelloOAuthServiceConfigFactory })`
   * (`@dereekb/trello/nestjs`) as this instance's {@link dependencyModule}.
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
   * Path on the app URL a successful SIGN-IN returns to. Defaults to `successPath`.
   */
  readonly signInSuccessPath?: Maybe<string>;
  /**
   * Path on the app URL a FAILED sign-in returns to. Defaults to `failurePath`.
   */
  readonly signInFailurePath?: Maybe<string>;
  /**
   * App paths a sign-in request may ask to return to instead of `signInSuccessPath`.
   */
  readonly allowedReturnPaths?: Maybe<readonly string[]>;
  /**
   * The scopes to request. Defaults to `DEFAULT_TRELLO_OAUTH_SCOPES`.
   */
  readonly scopes?: Maybe<readonly TrelloOAuthScope[]>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Trello external-connection OAuth
 * module.
 *
 * Opt-in: importing the Trello OAuth module alone never mounts HTTP routes.
 *
 * The importing module must also supply `UserExternalConnectionServerActions`,
 * `UserExternalConnectionAccessor` and `UserExternalConnectionStateCoder` — all exported by
 * `appUserExternalConnectionModuleMetadata`, so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Trello connect endpoints.
 */
export function appTrelloUserExternalConnectionOAuthModuleMetadata(config: ProvideAppTrelloUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, successPath, failurePath, signInSuccessPath, signInFailurePath, allowedReturnPaths, scopes, imports, exports, providers } = config;
  const providerType = config.providerType ?? TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];
  const serviceToken = trelloUserExternalConnectionOAuthServiceToken(providerType);
  // the service is always registered under its class token, which the controller injects; another
  // provider type re-exports it under its own token so it cannot collide with the default connection's
  const serviceAliasProviders: Provider[] = serviceToken === TrelloUserExternalConnectionOAuthService ? [] : [{ provide: serviceToken, useExisting: TrelloUserExternalConnectionOAuthService }];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [trelloUserExternalConnectionOAuthControllerForProviderType(providerType)],
    exports: [serviceToken, ...(exports ?? [])],
    providers: [
      {
        provide: TrelloUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => trelloUserExternalConnectionOAuthServiceConfigFactory({ envService, providerType, successPath, failurePath, signInSuccessPath, signInFailurePath, allowedReturnPaths, scopes })
      },
      TrelloUserExternalConnectionOAuthService,
      ...serviceAliasProviders,
      ...(providers ?? [])
    ]
  };
}
