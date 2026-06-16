import { type InjectionToken } from '@nestjs/common';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';

/**
 * Structured analytics event emitted once per completed MCP tool invocation.
 *
 * Captures the full context of a single MCP tool invocation — the tool, its dispatch
 * coordinates, the outcome (success vs. error and the thrown error), the authenticated
 * caller, and the read-only mode.
 *
 * MCP-transport scoped and complementary to the model-handler `OnCallModelAnalyticsEvent`,
 * which continues to fire inside the callModel dispatch chain for callModel-backed tools.
 *
 * Consumed by {@link McpAnalyticsService} implementations registered under {@link MCP_ANALYTICS_SERVICE}.
 */
export interface McpAnalyticsEvent {
  /**
   * The event identity — the dispatched tool name (e.g., `'guestbook-create'`).
   */
  readonly event: string;
  /**
   * Whether the tool call completed successfully. `false` when the resolved outcome carried a
   * thrown error or the response was flagged `isError`.
   */
  readonly isSuccessful: boolean;
  /**
   * The dispatched tool name. Mirrors {@link event}, kept explicit for clarity at the consumer.
   */
  readonly toolName: string;
  /**
   * Whether the tool routes through the callModel dispatch chain or is a static built-in tool
   * (e.g., `model-get`, `whoami`).
   */
  readonly toolKind: 'callModel' | 'static';
  /**
   * The CRUD operation type for callModel-backed tools (e.g., `'create'`, `'read'`).
   */
  readonly call?: Maybe<string>;
  /**
   * The model type for callModel-backed tools (e.g., `'guestbook'`).
   */
  readonly modelType?: Maybe<string>;
  /**
   * The operation specifier for variant handlers, when present.
   */
  readonly specifier?: Maybe<string>;
  /**
   * The Firebase Auth UID of the calling user, if authenticated.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  /**
   * The full MCP request auth context, if available.
   */
  readonly auth?: Maybe<FirebaseServerAuthData>;
  /**
   * Whether the MCP server is running in read-only mode.
   */
  readonly readOnly?: Maybe<boolean>;
  /**
   * The raw tool arguments passed to the call, with the auto-injected reason parameter already
   * stripped (so it never appears twice — once here and once on {@link reason}).
   */
  readonly args?: Maybe<Record<string, unknown>>;
  /**
   * The auto-injected, human-readable reason the caller supplied for this tool call, clamped to the
   * configured max length. `undefined` when the reason parameter is disabled, absent, or the tool
   * declares its own field of the same name. Recorded for analytics/audit only.
   */
  readonly reason?: Maybe<string>;
  /**
   * Custom key-value properties. Reserved for future use.
   */
  readonly properties?: Maybe<Record<string, any>>;
  /**
   * The thrown error, when the call failed ({@link isSuccessful} is `false`).
   */
  readonly error?: Maybe<unknown>;
  /**
   * Wall-clock duration in milliseconds from dispatch start to completion.
   */
  readonly durationMs?: Maybe<number>;
}

/**
 * Abstract analytics service that apps implement to process MCP analytics events.
 *
 * Analogous to {@link OnCallModelAnalyticsService} but scoped to the MCP transport.
 * Apps extend this class and provide it via {@link MCP_ANALYTICS_SERVICE}.
 */
export abstract class McpAnalyticsService {
  abstract handleMcpAnalyticsEvent(event: McpAnalyticsEvent): void;
}

/**
 * Injection token for the MCP analytics service.
 * Apps provide this in their MCP module to enable analytics in the MCP dispatch chain.
 */
export const MCP_ANALYTICS_SERVICE = 'MCP_ANALYTICS_SERVICE' as InjectionToken<McpAnalyticsService>;

/**
 * Creates a no-op {@link McpAnalyticsService} that silently discards all events.
 *
 * Used as the default fallback by {@link McpServerFactoryService} when no analytics
 * service is registered.
 *
 * @returns An {@link McpAnalyticsService} that discards all analytics events.
 * @__NO_SIDE_EFFECTS__
 */
export function noopMcpAnalyticsService(): McpAnalyticsService {
  return { handleMcpAnalyticsEvent: () => undefined };
}
