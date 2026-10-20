import { type ModuleMetadata } from '@nestjs/common';
import { type ClassType } from '@dereekb/util';
import { DocsApiController } from './docs.api.controller';
import { DocsApiService } from './docs.api.service';

// MARK: Config
/**
 * Configuration for {@link docsApiModuleMetadata}.
 */
export interface DocsApiModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the docs API's dependencies.
   *
   * Should provide:
   * - `DocsApiModuleConfig` — `docsRoot` + `docsManifestPath` (and optionally `requiredScope`). Without them the
   *   API serves no file docs.
   * - `DOCS_AUDIENCE_READER` — the caller → audiences reader (see `docsAudienceReaderForRoles`). Without it every
   *   caller holds only the `any` audience, and a warning is logged at boot.
   * - `DYNAMIC_DOCS_SOURCES` (optional) — the `DynamicDocsSource` array for docs built in code, served next to the file
   *   docs under the same checks. Export it too; a token that is provided but not exported is silently ignored.
   */
  readonly dependencyModule: ClassType;
}

// MARK: Module Metadata
/**
 * Generates NestJS module metadata for the audience-gated docs API.
 *
 * Remember to add `FIREBASE_SERVER_DOCS_API_PROTECTED_PATH` (`'/api/docs'`) to the OIDC module's `protectedPaths`.
 * To expose the docs through MCP too, import AND export this module from the MCP dependency module so the MCP
 * server factory can inject {@link DocsApiService}.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata exposing the docs controller + service.
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     { provide: DocsApiModuleConfig, useValue: { docsRoot, docsManifestPath } },
 *     { provide: DOCS_AUDIENCE_READER, useValue: docsAudienceReaderForRoles({ roleReader, audiences: { admin: [AUTH_ADMIN_ROLE] } }) },
 *     { provide: DYNAMIC_DOCS_SOURCES, useFactory: () => [demoDynamicDocsSource()] }
 *   ],
 *   exports: [DocsApiModuleConfig, DOCS_AUDIENCE_READER, DYNAMIC_DOCS_SOURCES]
 * })
 * export class DemoDocsApiDependencyModule {}
 *
 * @Module(docsApiModuleMetadata({ dependencyModule: DemoDocsApiDependencyModule }))
 * export class DemoDocsApiModule {}
 * ```
 */
export function docsApiModuleMetadata(metadataConfig: DocsApiModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [DocsApiController],
    exports: [DocsApiService, ...(exports ?? [])],
    providers: [DocsApiService, ...(providers ?? [])]
  };
}
