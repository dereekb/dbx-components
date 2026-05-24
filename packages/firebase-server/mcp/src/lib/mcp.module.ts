import { type ModuleMetadata } from '@nestjs/common';
import { type ClassType } from '@dereekb/util';
import { McpController, McpWellKnownController } from './controller';
import { McpServerFactoryService } from './service/mcp.server.factory';

/**
 * Routes the firebase-server/mcp module owns. Apps should exclude these from
 * any global API route prefix (`globalApiRoutePrefix.exclude`) so the canonical
 * URLs land at `/.well-known/...` and `/mcp` rather than `/api/.well-known/...`.
 */
export const FIREBASE_SERVER_MCP_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE: string[] = ['.well-known/{*path}', 'mcp'];

/**
 * Configuration for {@link mcpModuleMetadata}.
 */
export interface McpModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies.
   *
   * Must provide:
   * - {@link ModelApiDispatchConfig} — so the MCP server can reuse the call model dispatch chain.
   * - {@link McpModuleConfig} — issuer + resource URLs for protected-resource discovery.
   *
   * In practice, downstream apps typically import their own `*ModelApiModule` first (which provides
   * `ModelApiCallModelDispatchService` + `MODEL_API_NEST_APPLICATION_CONTEXT`) and add the
   * `McpModuleConfig` provider in the dependency module passed here.
   */
  readonly dependencyModule: ClassType;
}

/**
 * Generates NestJS module metadata for the firebase-server/mcp module.
 *
 * Mirrors the convention used by {@link modelApiModuleMetadata}: the consumer provides
 * a dependency module that exposes the required tokens, and this factory wires up the
 * controllers + factory service.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata exposing the MCP transport + well-known controller.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [DemoModelApiModule],
 *   providers: [{ provide: McpModuleConfig, useValue: { oidcIssuer, mcpUrl } }],
 *   exports: [McpModuleConfig, ModelApiCallModelDispatchService, MODEL_API_NEST_APPLICATION_CONTEXT]
 * })
 * export class DemoMcpDependencyModule {}
 *
 * @Module(mcpModuleMetadata({ dependencyModule: DemoMcpDependencyModule }))
 * export class DemoMcpModule {}
 * ```
 */
export function mcpModuleMetadata(metadataConfig: McpModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [McpController, McpWellKnownController],
    exports: [McpServerFactoryService, ...(exports ?? [])],
    providers: [McpServerFactoryService, ...(providers ?? [])]
  };
}
