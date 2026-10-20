import { existsSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { AUTH_ADMIN_ROLE, AUTH_ONBOARDED_ROLE, type AuthClaims } from '@dereekb/util';
import { DOCS_AUDIENCE_READER, DocsApiModuleConfig, type DocsAudienceReader, docsApiModuleMetadata, docsAudienceReaderForRoles, DYNAMIC_DOCS_SOURCES, type DynamicDocsSource } from '@dereekb/firebase-server';
import { DEMO_AUTH_CLAIMS_SERVICE } from 'demo-firebase';
import { resolveDistArtifactPath } from '../dist.path';
import { demoNotificationTypesDocsSource } from './docs.notification';

/**
 * Absolute path to the deployed docs folder (`apps/demo-api/src/assets/docs`, copied to `dist/.../assets/docs` by
 * `build-base`'s `assets` glob).
 *
 * A SIBLING of the download module's `assets/secure`, never inside it: every file under the secure root can be minted
 * as a signed download, which would bypass a doc's audience.
 */
export const DEMO_DOCS_ROOT = resolveDistArtifactPath('assets/docs');

/**
 * Absolute path to the `docs.manifest.json` written by demo-api's `generate-docs-manifest` target.
 */
export const DEMO_DOCS_MANIFEST_PATH = resolveDistArtifactPath('docs.manifest.json');

/**
 * Doc audiences for the demo app, matching the generator's `--audiences=admin,user` allow-list.
 *
 * - `admin` — admins only.
 * - `user` — onboarded users (and admins, who see everything).
 *
 * Docs published to `any` are visible to every authenticated caller.
 */
export const DEMO_DOCS_AUDIENCE_ROLES = {
  admin: [AUTH_ADMIN_ROLE],
  user: [AUTH_ONBOARDED_ROLE, AUTH_ADMIN_ROLE]
};

/**
 * Maps a caller's demo claims to the doc audiences they hold.
 */
export const demoDocsAudienceReader: DocsAudienceReader = docsAudienceReaderForRoles({
  roleReader: (auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles((auth.token ?? {}) as unknown as AuthClaims),
  audiences: DEMO_DOCS_AUDIENCE_ROLES
});

/**
 * Builds the docs API config for the demo app.
 *
 * Each path is only supplied when it EXISTS on disk, like the download module's secure root: an unbuilt dist then
 * serves no docs (the service logs why) instead of failing every request.
 *
 * @returns The docs module config for this environment.
 */
export function demoDocsApiModuleConfigFactory(): DocsApiModuleConfig {
  return {
    ...(existsSync(DEMO_DOCS_ROOT) ? { docsRoot: DEMO_DOCS_ROOT } : undefined),
    ...(existsSync(DEMO_DOCS_MANIFEST_PATH) ? { docsManifestPath: DEMO_DOCS_MANIFEST_PATH } : undefined)
  };
}

/**
 * Dependency module for {@link DemoDocsApiModule}.
 */
@Module({
  providers: [
    {
      provide: DocsApiModuleConfig,
      useFactory: demoDocsApiModuleConfigFactory
    },
    {
      provide: DOCS_AUDIENCE_READER,
      useValue: demoDocsAudienceReader
    },
    {
      provide: DYNAMIC_DOCS_SOURCES,
      useFactory: (): DynamicDocsSource[] => [demoNotificationTypesDocsSource()]
    }
  ],
  exports: [DocsApiModuleConfig, DOCS_AUDIENCE_READER, DYNAMIC_DOCS_SOURCES]
})
export class DemoDocsApiDependencyModule {}

/**
 * Registers the audience-gated docs API for the demo app: the markdown docs in `src/assets/docs`, plus the dynamic docs
 * of {@link demoNotificationTypesDocsSource}.
 *
 * Routes: `GET /api/docs`, `GET /api/docs/search`, `GET /api/docs/read`. Bearer-protected — `'/api/docs'` is in
 * `DemoApiOidcModule`'s `protectedPaths`. `DemoMcpDependencyModule` imports and re-exports this module so the MCP
 * server factory can inject the docs service for its documentation tools.
 */
@Module(
  docsApiModuleMetadata({
    dependencyModule: DemoDocsApiDependencyModule
  })
)
export class DemoDocsApiModule {}
