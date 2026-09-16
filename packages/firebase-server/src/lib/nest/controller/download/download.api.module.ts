import { type ModuleMetadata } from '@nestjs/common';
import { type ClassType } from '@dereekb/util';
import { DownloadApiController } from './download.api.controller';
import { DownloadApiService } from './download.api.service';

// MARK: Config
/**
 * Configuration for {@link downloadApiModuleMetadata}.
 */
export interface DownloadApiModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the download endpoint's dependencies.
   *
   * Should provide:
   * - {@link DownloadApiModuleConfig} — the absolute secure-assets root and the API base URL. Without
   *   a resolvable root every request fails closed.
   * - `DOWNLOAD_TOKEN_SIGNER` — the app's JWT signer/verifier, typically adapting
   *   `OidcJwtSigningService` so the provider's own JWKS signs the capability tokens.
   */
  readonly dependencyModule: ClassType;
}

// MARK: Module Metadata
/**
 * Generates NestJS module metadata for the signed asset-download API.
 *
 * Mirrors `sessionApiModuleMetadata`: the consumer provides a dependency module exposing the
 * required tokens and this factory wires the controller + service.
 *
 * Do NOT add `'/api/download'` to the OIDC module's `protectedPaths` — the route authenticates via
 * its signed `asset` query parameter, and a bearer middleware would 401 the very callers it exists
 * for.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata exposing the download controller + service.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [MyOidcModule],
 *   providers: [
 *     { provide: DownloadApiModuleConfig, useValue: { secureAssetsRoot, apiBaseUrl } },
 *     { provide: DOWNLOAD_TOKEN_SIGNER, useFactory: oidcDownloadTokenSignerFactory, inject: [OidcJwtSigningService] }
 *   ],
 *   exports: [DownloadApiModuleConfig, DOWNLOAD_TOKEN_SIGNER]
 * })
 * export class MyDownloadDependencyModule {}
 *
 * @Module(downloadApiModuleMetadata({ dependencyModule: MyDownloadDependencyModule }))
 * export class MyDownloadApiModule {}
 * ```
 */
export function downloadApiModuleMetadata(metadataConfig: DownloadApiModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [DownloadApiController],
    exports: [DownloadApiService, ...(exports ?? [])],
    providers: [DownloadApiService, ...(providers ?? [])]
  };
}
