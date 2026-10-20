import { MODEL_GET_TOOL_NAME, mcpDocsAnalyticsToolConfigs, type McpToolAnalyticsConfigs } from '@dereekb/firebase-server/mcp';
import { DEMO_MCP_API_STATUS_TOOL_NAME } from './mcp.module';

/**
 * Name of the extra event the demo sends for each `model-get` call.
 */
export const DEMO_MCP_MODEL_VIEWED_ANALYTICS_EVENT_NAME = 'Mcp Model Viewed';

/**
 * Value the demo merges into the default event of the {@link DEMO_MCP_API_STATUS_TOOL_NAME} tool as `toolGroup`.
 */
export const DEMO_MCP_STATUS_TOOL_GROUP = 'status';

/**
 * Per-tool MCP analytics for the demo: one example of each lever in McpToolAnalyticsConfig.
 *
 * @returns The per-tool configs passed to `appMcpAnalyticsModuleMetadata` as `mcpAnalyticsConfig.tools`.
 */
export function demoMcpAnalyticsToolConfigs(): McpToolAnalyticsConfigs {
  return {
    // Default event off, custom events on: a 'Docs Search' / 'Docs Read' event replaces 'Mcp Tool Call'.
    ...mcpDocsAnalyticsToolConfigs(),
    // Merge: tag the app-supplied status tool so dashboards can filter it.
    [DEMO_MCP_API_STATUS_TOOL_NAME]: { defaultEventData: { toolGroup: DEMO_MCP_STATUS_TOOL_GROUP } },
    // Update: add the duration the default event leaves out.
    'guestbook.create': { defaultEventData: (data, event) => ({ ...data, durationMs: event.durationMs ?? 0 }) },
    // Default kept, plus a custom event built from the args.
    [MODEL_GET_TOOL_NAME]: {
      onComplete: (emitter, event) => {
        const keys = event.args?.['keys'];
        emitter.sendEvent(DEMO_MCP_MODEL_VIEWED_ANALYTICS_EVENT_NAME, { keys: Array.isArray(keys) ? keys.join(',') : '' });
      }
    }
  };
}
