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
 * Registered tools (clustered by domain — form, ui, model, storagefile,
 * notification, system, action, artifact):
 *
 * | Tool                                    | Purpose       | One-liner                                              |
 * |-----------------------------------------|---------------|--------------------------------------------------------|
 * | dbx_form_lookup                         | Documentation | "Tell me about forge entry X"                          |
 * | dbx_form_search                         | Discovery     | "Find forge entries matching keywords"                 |
 * | dbx_form_examples                       | Working code  | "Show me how to compose X"                             |
 * | dbx_form_scaffold                       | Generation    | "Generate a FormConfig skeleton"                       |
 * | dbx_ui_lookup                           | Documentation | "Tell me about dbx-web component X"                    |
 * | dbx_ui_search                           | Discovery     | "Find dbx-web components matching keywords"            |
 * | dbx_ui_examples                         | Working code  | "Show me a settings-section / list-page layout"        |
 * | dbx_model_lookup                        | Documentation | "Tell me about Firebase model X"                       |
 * | dbx_model_search                        | Discovery     | "Find Firebase models matching keywords"               |
 * | dbx_model_decode                        | Decoding      | "What does this Firestore doc mean?"                   |
 * | dbx_model_validate                      | Verification  | "Is this Firestore model file correct?"                |
 * | dbx_model_validate_api                  | Verification  | "Is this model api file correct?"                      |
 * | dbx_model_validate_folder               | Verification  | "Does this model folder have the 5 files?"             |
 * | dbx_storagefile_model_validate_app      | Verification  | "Is every storagefile purpose wired end-to-end?"       |
 * | dbx_storagefile_model_list_app          | Discovery     | "What storagefile purposes does this app configure?"   |
 * | dbx_storagefile_model_validate_folder   | Verification  | "Does this storagefile folder follow the convention?"  |
 * | dbx_notification_model_validate_app     | Verification  | "Is every app notification wired end-to-end?"          |
 * | dbx_notification_model_list_app         | Discovery     | "What notifications does this app configure?"          |
 * | dbx_notification_model_validate_folder  | Verification  | "Does this notification folder follow the convention?" |
 * | dbx_system_model_validate_folder        | Verification  | "Is this system folder set up correctly?"              |
 * | dbx_action_lookup                       | Documentation | "Tell me about action directive / state X"             |
 * | dbx_action_examples                     | Working code  | "Show me how to wire an action like X"                 |
 * | dbx_action_scaffold                     | Generation    | "Scaffold the action stack for use case X"             |
 * | dbx_artifact_scaffold                   | Generation    | "Give me the body for a new <artifact>."               |
 * | dbx_artifact_file_convention            | Reference     | "Where do I put a new <artifact>?"                     |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { lookupForgeTool } from './lookup-forge.tool.js';
import { searchForgeTool } from './search-forge.tool.js';
import { formExamplesTool } from './form-examples.tool.js';
import { formScaffoldTool } from './form-scaffold.tool.js';
import { lookupUiTool } from './lookup-ui.tool.js';
import { searchUiTool } from './search-ui.tool.js';
import { uiExamplesTool } from './ui-examples.tool.js';
import { lookupModelTool } from './lookup-model.tool.js';
import { searchModelTool } from './search-model.tool.js';
import { modelDecodeTool } from './model-decode.tool.js';
import { modelValidateTool } from './model-validate.tool.js';
import { modelValidateApiTool } from './model-validate-api.tool.js';
import { modelValidateFolderTool } from './model-validate-folder.tool.js';
import { storageFileModelValidateAppTool } from './storagefile-model-validate-app.tool.js';
import { storageFileModelListAppTool } from './storagefile-model-list-app.tool.js';
import { storageFileModelValidateFolderTool } from './storagefile-model-validate-folder.tool.js';
import { notificationModelValidateAppTool } from './notification-model-validate-app.tool.js';
import { notificationModelListAppTool } from './notification-model-list-app.tool.js';
import { notificationModelValidateFolderTool } from './notification-model-validate-folder.tool.js';
import { systemModelValidateFolderTool } from './system-model-validate-folder.tool.js';
import { lookupActionTool } from './lookup-action.tool.js';
import { actionExamplesTool } from './action-examples.tool.js';
import { actionScaffoldTool } from './action-scaffold.tool.js';
import { artifactScaffoldTool } from './artifact-scaffold.tool.js';
import { artifactFileConventionTool } from './artifact-file-convention.tool.js';
import { toolError, type DbxTool } from './types.js';

/**
 * Every registered tool in order of presentation in `tools/list`.
 *
 * Order clusters tools by domain so callers see related entries together:
 * form → ui → model → storagefile → notification → system → action → artifact.
 */
export const DBX_TOOLS: readonly DbxTool[] = [
  // form
  lookupForgeTool,
  searchForgeTool,
  formExamplesTool,
  formScaffoldTool,
  // ui
  lookupUiTool,
  searchUiTool,
  uiExamplesTool,
  // model
  lookupModelTool,
  searchModelTool,
  modelDecodeTool,
  modelValidateTool,
  modelValidateApiTool,
  modelValidateFolderTool,
  // storagefile
  storageFileModelValidateAppTool,
  storageFileModelListAppTool,
  storageFileModelValidateFolderTool,
  // notification
  notificationModelValidateAppTool,
  notificationModelListAppTool,
  notificationModelValidateFolderTool,
  // system
  systemModelValidateFolderTool,
  // action
  lookupActionTool,
  actionExamplesTool,
  actionScaffoldTool,
  // artifact (cross-domain dispatchers)
  artifactScaffoldTool,
  artifactFileConventionTool
];

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
