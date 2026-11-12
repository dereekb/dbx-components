import { type InjectionToken, type ModuleMetadata, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionProviderType, type UserExternalConnectionScopePreset, type UserExternalConnectionScopePresetKey } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { userExternalConnectionOAuthServiceTokenForProviderType } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { MicrosoftUserExternalConnectionOAuthServiceConfig, microsoftUserExternalConnectionOAuthServiceConfigFactory } from './microsoft.oauth.connection.config';
import { microsoftUserExternalConnectionOAuthControllerForProviderType } from './microsoft.oauth.connection.controller';
import { MicrosoftUserExternalConnectionOAuthService } from './microsoft.oauth.connection.service';

// MARK: Service Token
/**
 * Returns the injection token a Microsoft connection's {@link MicrosoftUserExternalConnectionOAuthService}
 * is exported under.
 *
 * The default provider type keeps the class token. Any other (e.g. `ms_graph`) gets a token of its own.
 *
 * @param providerType - The provider type of the Microsoft connection. Defaults to {@link MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}.
 * @returns The token to list in `userExternalConnectionOAuthProviderRegistryProvider()`.
 */
export function microsoftUserExternalConnectionOAuthServiceToken(providerType?: Maybe<UserExternalConnectionProviderType>): InjectionToken {
  return userExternalConnectionOAuthServiceTokenForProviderType({ providerType, defaultProviderType: MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, serviceClass: MicrosoftUserExternalConnectionOAuthService, tokenPrefix: 'MicrosoftUserExternalConnectionOAuthService' });
}

// MARK: App Microsoft UserExternalConnection OAuth Module
export interface ProvideAppMicrosoftUserExternalConnectionOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * This module requires `MicrosoftOAuthApi` (from `appMicrosoftOAuthModuleMetadata` in
   * `@dereekb/microsoft/nestjs`). This declaration makes it easier to import a module that exports it.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * The provider type this Microsoft connection is stored and routed under. Defaults to `microsoft`.
   *
   * Mounts at `/oauth/<providerType>`, and its service is exported under
   * {@link microsoftUserExternalConnectionOAuthServiceToken}. A non-default instance needs its redirect URI
   * (`<apiUrl>/oauth/<providerType>/callback`) on the Entra app registration, its routes excluded from the
   * global route prefix, and its service token in the app's `UserExternalConnectionOAuthProviderRegistry`.
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
   * The scope presets a user picks from. Defaults to the Microsoft Read / Read + Write presets.
   */
  readonly scopePresets?: Maybe<readonly UserExternalConnectionScopePreset[]>;
  /**
   * The preset a connect uses when the request names none. Defaults to `read`.
   */
  readonly defaultScopePreset?: Maybe<UserExternalConnectionScopePresetKey>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's Microsoft external-connection OAuth
 * module.
 *
 * The importing module must also supply `UserExternalConnectionServerActions`,
 * `UserExternalConnectionAccessor` and `UserExternalConnectionStateCoder` — all exported by
 * `appUserExternalConnectionModuleMetadata`, so pass that module in `imports`.
 *
 * @param config - The module metadata configuration.
 * @returns NestJS ModuleMetadata mounting the Microsoft connect endpoints.
 */
export function appMicrosoftUserExternalConnectionOAuthModuleMetadata(config: ProvideAppMicrosoftUserExternalConnectionOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, successPath, failurePath, scopePresets, defaultScopePreset, imports, exports, providers } = config;
  const providerType = config.providerType ?? MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];
  const serviceToken = microsoftUserExternalConnectionOAuthServiceToken(providerType);
  const serviceAliasProviders: Provider[] = serviceToken === MicrosoftUserExternalConnectionOAuthService ? [] : [{ provide: serviceToken, useExisting: MicrosoftUserExternalConnectionOAuthService }];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    controllers: [microsoftUserExternalConnectionOAuthControllerForProviderType(providerType)],
    exports: [serviceToken, ...(exports ?? [])],
    providers: [
      {
        provide: MicrosoftUserExternalConnectionOAuthServiceConfig,
        inject: [FirebaseServerEnvService],
        useFactory: (envService: FirebaseServerEnvService) => microsoftUserExternalConnectionOAuthServiceConfigFactory({ envService, providerType, successPath, failurePath, scopePresets, defaultScopePreset })
      },
      MicrosoftUserExternalConnectionOAuthService,
      ...serviceAliasProviders,
      ...(providers ?? [])
    ]
  };
}
