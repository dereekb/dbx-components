import { type AnalyticsEventData, type AnalyticsEventName } from '@dereekb/analytics';
import { type Maybe } from '@dereekb/util';
import { mcpMethodIdForDispatch } from '../mcp.method';
import { type McpAnalyticsEvent } from './mcp.analytics.handler';

/**
 * Sends extra analytics events for one completed MCP tool call. Passed to {@link McpToolAnalyticsConfig.onComplete}.
 *
 * Mirrors `OnCallAnalyticsEmitter.sendEvent` from callModel analytics. Events go to the calling user (the event's `uid`).
 */
export interface McpToolAnalyticsEmitter {
  /**
   * Sends a named event to the app's `FirebaseServerAnalyticsService`.
   *
   * @param name - The event name, e.g. `'Docs Search'`.
   * @param data - The event's data. Defaults to an empty object.
   */
  sendEvent(name: AnalyticsEventName, data?: AnalyticsEventData): void;
}

/**
 * Builds the data for the default event from the default data and the event. May update or replace the data.
 */
export type McpToolAnalyticsDefaultEventDataFunction = (data: AnalyticsEventData, event: McpAnalyticsEvent) => AnalyticsEventData;

/**
 * Per-tool analytics configuration for {@link FirebaseServerMcpAnalyticsService}.
 *
 * Configured on the app side through {@link FirebaseServerMcpAnalyticsConfig.tools}, keyed as described by
 * {@link mcpToolAnalyticsKeys}, so it covers built-in tools (e.g. docs search) as well as app tools.
 *
 * @example
 * ```typescript
 * const tools: McpToolAnalyticsConfigs = {
 *   // Merge into the default event.
 *   demo_api_status: { defaultEventData: { toolGroup: 'status' } },
 *   // Turn off the default event and send a custom one instead.
 *   'docs.search': { sendDefaultEvent: false, onComplete: (emitter, event) => emitter.sendEvent('Docs Search', { query: String(event.args?.['query'] ?? '') }) }
 * };
 * ```
 */
export interface McpToolAnalyticsConfig {
  /**
   * `false` turns off the default event (`FirebaseServerMcpAnalyticsConfig.eventName`) for this tool. Defaults to true.
   */
  readonly sendDefaultEvent?: boolean;
  /**
   * Changes the default event's data. An object is merged over the default data. A function receives the default data
   * and the event and returns the data to send, so it can update or replace it.
   */
  readonly defaultEventData?: AnalyticsEventData | McpToolAnalyticsDefaultEventDataFunction;
  /**
   * Runs once the call completes (success or failure). Send extra events, e.g. `Docs Search`, built from the event's
   * args and result.
   */
  readonly onComplete?: (emitter: McpToolAnalyticsEmitter, event: McpAnalyticsEvent) => void;
}

/**
 * Per-tool analytics configs, keyed by method id, dispatch key or tool name. See {@link mcpToolAnalyticsKeys}.
 */
export type McpToolAnalyticsConfigs = Readonly<Record<string, McpToolAnalyticsConfig>>;

/**
 * Returns the keys an event's per-tool analytics config is looked up by, most specific first:.
 *
 * 1. {@link McpAnalyticsEvent.method}, the routed method id (`guestbook.create`, `docs-read`, `demo_api_status`).
 * 2. The dispatch key of the executed tool in method-id form, `modelType.call[.specifier]` without the default
 *    specifier (`docs.search`, `docs.read`, `guestbook.create`). It is the same whatever the tool-name prefix is.
 * 3. {@link McpAnalyticsEvent.toolName}, the wire tool name (`search_demo_documentation`, or `demo_api_read`, which
 *    covers every routed read).
 *
 * The tool name comes last so a config on a compact router does not override the config of a method reached through it.
 *
 * @param event - The completed call's event.
 * @returns The lookup keys, without duplicates.
 *
 * @example
 * ```typescript
 * mcpToolAnalyticsKeys({ toolName: 'demo_api_read', method: 'docs-read', modelType: 'docs', call: 'read', ... });
 * // ['docs-read', 'docs.read', 'demo_api_read']
 * ```
 */
export function mcpToolAnalyticsKeys(event: McpAnalyticsEvent): string[] {
  const { method, modelType, call, specifier, toolName } = event;
  const dispatchKey = modelType != null && call != null ? mcpMethodIdForDispatch({ modelType, call, specifier: specifier ?? undefined }) : undefined;
  const keys = [method, dispatchKey, toolName].filter((key): key is string => key != null && key.length > 0);
  return Array.from(new Set(keys));
}

/**
 * Finds the per-tool analytics config for an event. The first key from {@link mcpToolAnalyticsKeys} that has a config wins.
 *
 * @param configs - The per-tool configs.
 * @param event - The completed call's event.
 * @returns The matching config, or `undefined` when none of the event's keys has one.
 */
export function findMcpToolAnalyticsConfig(configs: Maybe<McpToolAnalyticsConfigs>, event: McpAnalyticsEvent): Maybe<McpToolAnalyticsConfig> {
  let result: Maybe<McpToolAnalyticsConfig>;

  if (configs != null) {
    const key = mcpToolAnalyticsKeys(event).find((x) => Object.hasOwn(configs, x));
    result = key == null ? undefined : configs[key];
  }

  return result;
}
