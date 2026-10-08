import { type ModuleMetadata } from '@nestjs/common';
import { type ClassType } from '@dereekb/util';
import { UserExternalConnectionTokenApiController } from './userexternalconnection.token.controller';
import { UserExternalConnectionTokenApiService } from './userexternalconnection.token.service';

/**
 * Configuration for {@link userExternalConnectionTokenApiModuleMetadata}.
 */
export interface UserExternalConnectionTokenApiModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the token API's dependencies:
   * - `UserExternalConnectionReader` — reads (and renews) the caller's credentials.
   * - `UserExternalConnectionOAuthProviderRegistry` — supplies each provider's exported `extra` keys.
   * - `UserExternalConnectionProviderPolicyRegistry` — the `tokenExport` opt-in. Without it no provider is exportable.
   * - `USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE` — the app's check. Without it every caller is refused.
   * - `UserExternalConnectionTokenApiModuleConfig` — optional.
   */
  readonly dependencyModule: ClassType;
}

/**
 * Generates NestJS module metadata for the external connection token API, which mints a caller's
 * access token for a provider they connected, e.g. so a provider CLI can call it without its own login.
 *
 * Mounted under `session/external`; the OIDC module's `protectedPaths` must cover `/api/session`.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata exposing the token controller + service.
 */
export function userExternalConnectionTokenApiModuleMetadata(metadataConfig: UserExternalConnectionTokenApiModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [UserExternalConnectionTokenApiController],
    exports: [UserExternalConnectionTokenApiService, ...(exports ?? [])],
    providers: [UserExternalConnectionTokenApiService, ...(providers ?? [])]
  };
}
