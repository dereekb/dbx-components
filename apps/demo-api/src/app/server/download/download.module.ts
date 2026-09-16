import { existsSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { DEFAULT_SECURE_ASSETS_DIRECTORY, DOWNLOAD_TOKEN_SIGNER, DownloadApiModuleConfig, FirebaseServerEnvService, downloadApiModuleMetadata } from '@dereekb/firebase-server';
import { OidcJwtSigningService, oidcDownloadTokenSigner } from '@dereekb/firebase-server/oidc';
import { DemoApiOidcModule } from '../../api/oidc/oidc.module';
import { resolveDistArtifactPath } from '../dist.path';

/**
 * Absolute path to the ONLY folder the demo API will ever serve an asset from.
 *
 * Resolved through the same three-cwd probe the dist manifests use — the Functions runtime, a
 * workspace-root run, and vitest all set a different `process.cwd()`. The folder is created on every
 * build by `build-base`'s existing `assets` glob (`apps/demo-api/src/assets` → `dist/.../assets`),
 * which is why `apps/demo-api/src/assets/secure/.gitkeep` is committed; the CLI artifact is copied
 * in afterwards by the `copy-cli-artifact` target.
 */
export const DEMO_SECURE_ASSETS_ROOT = resolveDistArtifactPath(DEFAULT_SECURE_ASSETS_DIRECTORY);

/**
 * Builds the signed asset-download config for the demo app.
 *
 * The secure root is only supplied when it actually EXISTS on disk: an unbuilt or partially-copied
 * dist would otherwise leave the endpoint half-enabled, minting URLs for files that cannot be read.
 * With no root the service logs a warning at boot and refuses every request.
 *
 * @param envService - The Firebase server environment service, used for the API base URL the minted URL is rooted at.
 * @returns The download module config for this environment.
 */
export function demoDownloadApiModuleConfigFactory(envService: FirebaseServerEnvService): DownloadApiModuleConfig {
  const apiBaseUrl = envService.appApiUrl ?? envService.appUrl;

  return {
    ...(existsSync(DEMO_SECURE_ASSETS_ROOT) ? { secureAssetsRoot: DEMO_SECURE_ASSETS_ROOT } : undefined),
    ...(apiBaseUrl ? { apiBaseUrl } : undefined)
  };
}

/**
 * Dependency module for {@link DemoDownloadApiModule}.
 *
 * Imports {@link DemoApiOidcModule} for {@link OidcJwtSigningService}: the download capability token
 * is signed with the OIDC provider's own JWKS, so there is no new secret to distribute and the key
 * rotates with the provider's.
 */
@Module({
  imports: [DemoApiOidcModule],
  providers: [
    {
      provide: DownloadApiModuleConfig,
      useFactory: demoDownloadApiModuleConfigFactory,
      inject: [FirebaseServerEnvService]
    },
    {
      provide: DOWNLOAD_TOKEN_SIGNER,
      useFactory: oidcDownloadTokenSigner,
      inject: [OidcJwtSigningService]
    }
  ],
  exports: [DownloadApiModuleConfig, DOWNLOAD_TOKEN_SIGNER]
})
export class DemoDownloadApiDependencyModule {}

/**
 * Registers the signed asset-download controller for the demo app.
 *
 * Route: `GET /api/download?asset=<signed token>`. Deliberately NOT in `DemoApiOidcModule`'s
 * `protectedPaths` — it authenticates via the signed query parameter, and a bearer middleware would
 * 401 the bare machine the feature exists for.
 */
@Module(
  downloadApiModuleMetadata({
    dependencyModule: DemoDownloadApiDependencyModule
  })
)
export class DemoDownloadApiModule {}
