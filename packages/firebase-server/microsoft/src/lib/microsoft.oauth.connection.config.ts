import { MICROSOFT_READ_SCOPE_PRESET_KEY, MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS, type UserExternalConnectionProviderType, type UserExternalConnectionScopePreset, type UserExternalConnectionScopePresetKey } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionOAuthServiceConfig, userExternalConnectionOAuthControllerPath, userExternalConnectionOAuthRoutesForGlobalRouteExclude, userExternalConnectionOAuthServiceConfigFactory } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';

/**
 * Controller path the default Microsoft external-connection OAuth endpoints are mounted at.
 */
export const MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH = userExternalConnectionOAuthControllerPath(MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * Routes to exclude from an app's global API route prefix so the default Microsoft callback controller
 * stays mounted at `/oauth/microsoft/*`.
 *
 * An instance under another provider type excludes its own with
 * `userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType)`.
 */
export const MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = userExternalConnectionOAuthRoutesForGlobalRouteExclude(MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);

/**
 * The preset a connect uses when the request names none: the least-privileged "Read".
 */
export const DEFAULT_MICROSOFT_SCOPE_PRESET_KEY: UserExternalConnectionScopePresetKey = MICROSOFT_READ_SCOPE_PRESET_KEY;

/**
 * Configuration for the {@link MicrosoftUserExternalConnectionOAuthService}.
 *
 * Adds nothing to the framework config: the scope set comes from the connect's scope preset, and the
 * client credentials and tenant belong to `MicrosoftOAuthServiceConfig` in `@dereekb/microsoft/nestjs`.
 */
export abstract class MicrosoftUserExternalConnectionOAuthServiceConfig extends UserExternalConnectionOAuthServiceConfig {}

export interface MicrosoftUserExternalConnectionOAuthServiceConfigFactoryConfig {
  readonly envService: FirebaseServerEnvService;
  /**
   * The provider type this Microsoft connection is stored and routed under. Defaults to
   * {@link MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE}. HelloSubs registers it as `ms_graph`.
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
   * The scope presets a user picks from when connecting. Defaults to
   * {@link MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS} (Read, and Read + Write).
   *
   * An app that declares its own must mirror them on the Angular provider.
   */
  readonly scopePresets?: Maybe<readonly UserExternalConnectionScopePreset[]>;
  /**
   * The preset a connect uses when the request names none. Defaults to {@link DEFAULT_MICROSOFT_SCOPE_PRESET_KEY}.
   */
  readonly defaultScopePreset?: Maybe<UserExternalConnectionScopePresetKey>;
}

/**
 * Builds the Microsoft connect flow's configuration from the app's configured origins.
 *
 * @param config - The env service, the provider type, the return paths, and the optional presets.
 * @returns The validated service configuration.
 */
export function microsoftUserExternalConnectionOAuthServiceConfigFactory(config: MicrosoftUserExternalConnectionOAuthServiceConfigFactoryConfig): MicrosoftUserExternalConnectionOAuthServiceConfig {
  const { envService, providerType, successPath, failurePath, scopePresets, defaultScopePreset } = config;

  return userExternalConnectionOAuthServiceConfigFactory({
    envService,
    providerType: providerType ?? MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE,
    successPath,
    failurePath,
    scopePresets: scopePresets ?? MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS,
    defaultScopePreset: defaultScopePreset ?? DEFAULT_MICROSOFT_SCOPE_PRESET_KEY
  });
}
