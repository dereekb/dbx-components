import { type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { MCP_ANALYTICS_SERVICE } from './mcp.analytics.handler';
import { FirebaseServerMcpAnalyticsService } from './mcp.analytics.service';
import { FIREBASE_SERVER_MCP_ANALYTICS_CONFIG, type FirebaseServerMcpAnalyticsConfig } from './mcp.analytics.config';

/**
 * Configuration for {@link appMcpAnalyticsModuleMetadata}.
 */
export interface AppMcpAnalyticsMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional {@link FirebaseServerMcpAnalyticsConfig} provided under
   * {@link FIREBASE_SERVER_MCP_ANALYTICS_CONFIG}. When omitted, the service uses its defaults.
   */
  readonly mcpAnalyticsConfig?: Maybe<FirebaseServerMcpAnalyticsConfig>;
}

/**
 * Generates NestJS module metadata that registers {@link FirebaseServerMcpAnalyticsService} as the
 * MCP analytics consumer, aliased to {@link MCP_ANALYTICS_SERVICE}.
 *
 * Mirrors the convention used by `appAnalyticsModuleMetadata`. Unlike `mcpModuleMetadata`, this
 * requires no dependency module — `FirebaseServerAnalyticsService` is resolved optionally and is
 * expected to be supplied globally by the app's analytics module.
 *
 * Decorate a `@Global()` module with the result so the `MCP_ANALYTICS_SERVICE` token is visible to
 * the `McpServerFactoryService` provided by the app's MCP module.
 *
 * @param config - Optional metadata + analytics config to merge in.
 * @returns NestJS module metadata providing + exporting the MCP analytics service and token.
 *
 * @example
 * ```typescript
 * @Global()
 * @Module(appMcpAnalyticsModuleMetadata())
 * export class AppMcpAnalyticsModule {}
 * ```
 */
export function appMcpAnalyticsModuleMetadata(config: AppMcpAnalyticsMetadataConfig = {}): ModuleMetadata {
  const { mcpAnalyticsConfig, imports, exports, providers } = config;
  const configProviders = mcpAnalyticsConfig ? [{ provide: FIREBASE_SERVER_MCP_ANALYTICS_CONFIG, useValue: mcpAnalyticsConfig }] : [];

  return {
    imports: [...(imports ?? [])],
    exports: [MCP_ANALYTICS_SERVICE, FirebaseServerMcpAnalyticsService, ...(exports ?? [])],
    providers: [
      FirebaseServerMcpAnalyticsService,
      {
        provide: MCP_ANALYTICS_SERVICE,
        useExisting: FirebaseServerMcpAnalyticsService
      },
      ...configProviders,
      ...(providers ?? [])
    ]
  };
}
