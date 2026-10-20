import { type AnalyticsEventData } from '@dereekb/analytics';
import { type DocsSearchResult } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { MCP_DOCS_DISPATCH_MODEL_TYPE, MCP_DOCS_SEARCH_DISPATCH_CALL } from '../tools/mcp.tool.docs-search';
import { MCP_DOCS_READ_DISPATCH_CALL } from '../tools/mcp.tool.docs-read';
import { type McpAnalyticsEvent } from './mcp.analytics.handler';
import { type McpToolAnalyticsConfigs } from './mcp.analytics.tool';

/**
 * Name of the event {@link mcpDocsAnalyticsToolConfigs} sends for each docs search.
 */
export const MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME = 'Docs Search';

/**
 * Name of the event {@link mcpDocsAnalyticsToolConfigs} sends for each docs read.
 */
export const MCP_DOCS_READ_ANALYTICS_EVENT_NAME = 'Docs Read';

/**
 * Per-tool analytics key of the docs search tool: its dispatch key, the same whatever the tool name is.
 */
export const MCP_DOCS_SEARCH_ANALYTICS_KEY = `${MCP_DOCS_DISPATCH_MODEL_TYPE}.${MCP_DOCS_SEARCH_DISPATCH_CALL}`;

/**
 * Per-tool analytics key of the `docs-read` method: its dispatch key, so it matches direct and routed reads.
 */
export const MCP_DOCS_READ_ANALYTICS_KEY = `${MCP_DOCS_DISPATCH_MODEL_TYPE}.${MCP_DOCS_READ_DISPATCH_CALL}`;

/**
 * Longest query text a `Docs Search` event carries. Longer queries are cut.
 */
export const MCP_DOCS_SEARCH_ANALYTICS_MAX_QUERY_LENGTH = 200;

/**
 * How many result ids a `Docs Search` event lists in `resultIds`.
 */
export const MCP_DOCS_SEARCH_ANALYTICS_MAX_RESULT_IDS = 5;

/**
 * Config for {@link mcpDocsSearchAnalyticsEventData} and {@link mcpDocsAnalyticsToolConfigs}.
 */
export interface McpDocsAnalyticsConfig {
  /**
   * Whether `Docs Search` events carry the query text. Set `false` for apps that can't store free text, since a query
   * may contain names. Defaults to true.
   */
  readonly includeQuery?: boolean;
}

/**
 * Reads the OIDC `client_id` of the caller's token, a second grouping key next to the uid.
 *
 * @param event - The completed call's event.
 * @returns The client id, or an empty string when the caller has none.
 */
function mcpDocsAnalyticsClientId(event: McpAnalyticsEvent): string {
  const clientId: unknown = event.auth?.token?.['client_id'];
  return typeof clientId === 'string' ? clientId : '';
}

/**
 * Builds a `Docs Search` event's data from a completed docs search call.
 *
 * Carries the query and limit from the args; `total`, `resultCount`, `topResultId` (`id`, or `id#section`), `resultIds`
 * (the top {@link MCP_DOCS_SEARCH_ANALYTICS_MAX_RESULT_IDS}, comma-joined) and `partial` from the result; and `success`,
 * `tool` and `clientId` from the event. The result fields are left out when the search failed.
 *
 * @param event - The completed docs search call's event.
 * @param config - Whether to include the query text.
 * @returns The event data.
 */
export function mcpDocsSearchAnalyticsEventData(event: McpAnalyticsEvent, config?: Maybe<McpDocsAnalyticsConfig>): AnalyticsEventData {
  const query = event.args?.['query'];
  const limit = event.args?.['limit'];
  const searchResult = event.result?.structuredContent as Maybe<DocsSearchResult>;
  let resultData: Maybe<AnalyticsEventData>;

  if (searchResult != null && Array.isArray(searchResult.results)) {
    const resultIds = searchResult.results.map((x) => (x.section == null ? x.id : `${x.id}#${x.section.id}`));

    resultData = {
      total: searchResult.total,
      resultCount: resultIds.length,
      topResultId: resultIds[0] ?? '',
      resultIds: resultIds.slice(0, MCP_DOCS_SEARCH_ANALYTICS_MAX_RESULT_IDS).join(','),
      partial: searchResult.partial === true
    };
  }

  return {
    ...(config?.includeQuery === false ? undefined : { query: typeof query === 'string' ? query.trim().slice(0, MCP_DOCS_SEARCH_ANALYTICS_MAX_QUERY_LENGTH) : '' }),
    ...(typeof limit === 'number' ? { limit } : undefined),
    ...resultData,
    success: event.isSuccessful,
    tool: event.toolName,
    clientId: mcpDocsAnalyticsClientId(event)
  };
}

/**
 * Builds a `Docs Read` event's data from a completed `docs-read` call.
 *
 * Carries the `id` and `section` from the args, and `success`, `reason` and `clientId` from the event. A failed read adds
 * `errorCode`, the thrown error's code: `DOCS_NOT_FOUND_ERROR_CODE` or `DOCS_SECTION_NOT_FOUND_ERROR_CODE` for a missing
 * doc or section.
 *
 * @param event - The completed docs read call's event.
 * @returns The event data.
 */
export function mcpDocsReadAnalyticsEventData(event: McpAnalyticsEvent): AnalyticsEventData {
  const id = event.args?.['id'];
  const section = event.args?.['section'];
  const error = event.error;
  const errorDetails: unknown = error != null && typeof error === 'object' ? (error as { readonly details?: unknown }).details : undefined;
  const errorCode: unknown = errorDetails != null && typeof errorDetails === 'object' ? (errorDetails as { readonly code?: unknown }).code : undefined;

  return {
    id: typeof id === 'string' ? id : '',
    section: typeof section === 'string' ? section : '',
    success: event.isSuccessful,
    reason: event.reason ?? '',
    clientId: mcpDocsAnalyticsClientId(event),
    ...(event.isSuccessful || typeof errorCode !== 'string' ? undefined : { errorCode })
  };
}

/**
 * Per-tool analytics configs for the docs tools: each docs search sends a `Docs Search` event and each docs read a
 * `Docs Read` event, in place of the default `Mcp Tool Call` event. Spread into
 * {@link FirebaseServerMcpAnalyticsConfig.tools}.
 *
 * The events are built to grow doc tags and aliases from what agents actually search. The server keeps no per-user
 * state; group the events downstream (Segment / warehouse):
 * - Order a user's `Docs Search` / `Docs Read` events by timestamp (Segment sets it on receipt), split by `clientId` as
 *   well, and start a new chain after a gap of more than about 2 minutes.
 * - Report zero-hit searches (`total` of 0) and `partial` searches (no doc matched every query word).
 * - Report chains of several searches that end in a `Docs Read` of a doc that wasn't the first search's `topResultId`.
 *   Each one suggests a tag or alias for that doc.
 *
 * @param config - Whether `Docs Search` events carry the query text.
 * @returns The configs, keyed by {@link MCP_DOCS_SEARCH_ANALYTICS_KEY} and {@link MCP_DOCS_READ_ANALYTICS_KEY}.
 *
 * @example
 * ```typescript
 * @Global()
 * @Module(appMcpAnalyticsModuleMetadata({ mcpAnalyticsConfig: { tools: mcpDocsAnalyticsToolConfigs() } }))
 * export class AppMcpAnalyticsModule {}
 * ```
 */
export function mcpDocsAnalyticsToolConfigs(config?: Maybe<McpDocsAnalyticsConfig>): McpToolAnalyticsConfigs {
  return {
    [MCP_DOCS_SEARCH_ANALYTICS_KEY]: {
      sendDefaultEvent: false,
      onComplete: (emitter, event) => emitter.sendEvent(MCP_DOCS_SEARCH_ANALYTICS_EVENT_NAME, mcpDocsSearchAnalyticsEventData(event, config))
    },
    [MCP_DOCS_READ_ANALYTICS_KEY]: {
      sendDefaultEvent: false,
      onComplete: (emitter, event) => emitter.sendEvent(MCP_DOCS_READ_ANALYTICS_EVENT_NAME, mcpDocsReadAnalyticsEventData(event))
    }
  };
}
