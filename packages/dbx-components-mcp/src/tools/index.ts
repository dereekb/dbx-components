/**
 * Central tool dispatcher for dbx-components-mcp.
 *
 * Schema strategy: tools advertise plain JSON Schema `inputSchema` entries
 * (through `tools/list`) and validate payloads with arktype inside each
 * handler. The high-level `McpServer.registerTool` API is deliberately
 * skipped because it is zod-coupled — arktype is the workspace standard.
 *
 * Each tool module exports a {@link DbxTool} containing its definition and
 * `run(args)` handler. This file sets the `tools/list` and `tools/call`
 * request handlers exactly once and routes calls by tool name.
 *
 * Registered tools:
 *
 * | Tool           | Purpose        | One-liner                              |
 * |----------------|----------------|----------------------------------------|
 * | dbx_lookup     | Documentation  | "Tell me about X"                      |
 * | dbx_search     | Discovery      | "Find entries matching keywords"       |
 * | dbx_examples   | Working code   | "Show me how to compose X"             |
 * | dbx_scaffold                | Generation     | "Generate a FormConfig skeleton"       |
 * | dbx_decode                  | Decoding       | "What does this Firestore doc mean?"   |
 * | dbx_validate_firebase_model | Verification   | "Is this Firestore model file correct?" |
 * | dbx_validate_model_api      | Verification   | "Is this model api file correct?"      |
 * | dbx_validate_model_folder   | Verification   | "Does this model folder have the 5 files?" |
 * | dbx_validate_system_folder  | Verification   | "Is this system folder set up correctly?" |
 * | dbx_validate_app_notifications | Verification | "Is every app notification wired end-to-end?" |
 * | dbx_list_app_notifications     | Discovery    | "What notifications does this app configure?" |
 * | dbx_validate_app_storagefiles  | Verification | "Is every storagefile purpose wired end-to-end?" |
 * | dbx_list_app_storagefiles      | Discovery    | "What storagefile purposes does this app configure?" |
 * | dbx_validate_storagefile_folder | Verification | "Does this storagefile folder follow the convention?" |
 * | dbx_validate_notification_folder | Verification | "Does this notification folder follow the convention?" |
 * | dbx_scaffold_artifact          | Generation   | "Give me the body for a new <artifact>." |
 * | dbx_file_convention            | Reference    | "Where do I put a new <artifact>?"     |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { lookupTool } from './lookup.tool.js';
import { searchTool } from './search.tool.js';
import { examplesTool } from './examples.tool.js';
import { scaffoldTool } from './scaffold.tool.js';
import { decodeTool } from './decode.tool.js';
import { validateFirebaseModelTool } from './validate-firebase-model.tool.js';
import { validateModelApiTool } from './validate-model-api.tool.js';
import { validateModelFolderTool } from './validate-model-folder.tool.js';
import { validateSystemFolderTool } from './validate-system-folder.tool.js';
import { validateAppNotificationsTool } from './validate-app-notifications.tool.js';
import { listAppNotificationsTool } from './list-app-notifications.tool.js';
import { validateAppStorageFilesTool } from './validate-app-storagefiles.tool.js';
import { listAppStorageFilesTool } from './list-app-storagefiles.tool.js';
import { validateStorageFileFolderTool } from './validate-storagefile-folder.tool.js';
import { validateNotificationFolderTool } from './validate-notification-folder.tool.js';
import { scaffoldArtifactTool } from './scaffold-artifact.tool.js';
import { fileConventionTool } from './file-convention.tool.js';
import { toolError, type DbxTool } from './types.js';

/**
 * Every registered tool in order of presentation in `tools/list`.
 */
export const DBX_TOOLS: readonly DbxTool[] = [lookupTool, searchTool, examplesTool, scaffoldTool, decodeTool, validateFirebaseModelTool, validateModelApiTool, validateModelFolderTool, validateSystemFolderTool, validateAppNotificationsTool, listAppNotificationsTool, validateAppStorageFilesTool, listAppStorageFilesTool, validateStorageFileFolderTool, validateNotificationFolderTool, scaffoldArtifactTool, fileConventionTool];

export function registerTools(server: McpServer): void {
  const underlyingServer = server.server;

  underlyingServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = { tools: DBX_TOOLS.map((t) => t.definition) };
    return result;
  });

  underlyingServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    const tool = DBX_TOOLS.find((t) => t.definition.name === name);
    if (!tool) {
      return toolError(`Unknown tool: ${name}. Known tools: ${DBX_TOOLS.map((t) => t.definition.name).join(', ')}.`);
    }
    const result = await tool.run(toolArgs);
    return result;
  });
}
