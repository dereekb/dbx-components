import { type InjectionToken } from '@nestjs/common';

/**
 * Default analytics event name used by {@link FirebaseServerMcpAnalyticsService} when
 * forwarding a completed MCP tool call to the downstream analytics pipeline.
 */
export const DEFAULT_MCP_ANALYTICS_EVENT_NAME = 'mcp-tool';

/**
 * Configuration for {@link FirebaseServerMcpAnalyticsService}.
 *
 * Apps provide this via {@link FIREBASE_SERVER_MCP_ANALYTICS_CONFIG} (typically through
 * {@link appMcpAnalyticsModuleMetadata}) to tune how completed MCP tool calls are logged
 * and forwarded.
 */
export interface FirebaseServerMcpAnalyticsConfig {
  /**
   * The analytics event name forwarded to the app's `FirebaseServerAnalyticsService`.
   * Defaults to {@link DEFAULT_MCP_ANALYTICS_EVENT_NAME}.
   */
  readonly eventName?: string;
  /**
   * Whether to emit a per-call `Logger` line for each completed tool call. Defaults to `true`.
   */
  readonly logEvents?: boolean;
}

/**
 * NestJS injection token for the optional {@link FirebaseServerMcpAnalyticsConfig} provider.
 *
 * @example
 * ```typescript
 * @Module(appMcpAnalyticsModuleMetadata({ mcpAnalyticsConfig: { eventName: 'mcp-tool', logEvents: true } }))
 * export class AppMcpAnalyticsModule {}
 * ```
 */
export const FIREBASE_SERVER_MCP_ANALYTICS_CONFIG = 'FIREBASE_SERVER_MCP_ANALYTICS_CONFIG' as InjectionToken<FirebaseServerMcpAnalyticsConfig>;
