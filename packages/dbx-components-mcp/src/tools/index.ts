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
 * Registered tools (clustered by domain — form, ui, model, storagefile_m,
 * notification_m, system_m, action, route, filter, pipe, artifact). The `_m`
 * suffix on the storagefile / notification / system clusters marks them as
 * model extensions: tools that walk a downstream app's source tree to verify
 * end-to-end wiring of a specific dbx-components model type.
 *
 * | Tool                                | Purpose       | One-liner                                              |
 * |-------------------------------------|---------------|--------------------------------------------------------|
 * | dbx_form_lookup                     | Documentation | "Tell me about form entry X"                           |
 * | dbx_form_search                     | Discovery     | "Find form entries matching keywords"                  |
 * | dbx_form_examples                   | Working code  | "Show me how to compose X"                             |
 * | dbx_form_scaffold                   | Generation    | "Generate a FormConfig skeleton"                       |
 * | dbx_ui_lookup                       | Documentation | "Tell me about dbx-web component X"                    |
 * | dbx_ui_search                       | Discovery     | "Find dbx-web components matching keywords"            |
 * | dbx_ui_examples                     | Working code  | "Show me a settings-section / list-page layout"        |
 * | dbx_model_lookup                    | Documentation | "Tell me about Firebase model X"                       |
 * | dbx_model_search                    | Discovery     | "Find Firebase models matching keywords"               |
 * | dbx_model_decode                    | Decoding      | "What does this Firestore doc mean?"                   |
 * | dbx_model_validate                  | Verification  | "Is this Firestore model file correct?"                |
 * | dbx_model_validate_api              | Verification  | "Is this model api file correct?"                      |
 * | dbx_model_validate_folder           | Verification  | "Does this model folder have the 5 files?"             |
 * | dbx_model_store_scaffold            | Generation    | "Scaffold the 4 store files for model X"               |
 * | dbx_model_fixture_list_app          | Discovery     | "What fixture/instance pairs does this app declare?"   |
 * | dbx_model_fixture_lookup            | Documentation | "Tell me about the fixture for model X"                |
 * | dbx_model_fixture_validate_app      | Verification  | "Is every fixture<->instance pair forwarded?"          |
 * | dbx_model_fixture_scaffold          | Generation    | "Add a new fixture/instance triplet for model X"       |
 * | dbx_model_fixture_forward           | Generation    | "Add the missing Fixture forwarders for instance methods" |
 * | dbx_storagefile_m_validate_app      | Verification  | "Is every storagefile purpose wired end-to-end?"       |
 * | dbx_storagefile_m_list_app          | Discovery     | "What storagefile purposes does this app configure?"   |
 * | dbx_storagefile_m_validate_folder   | Verification  | "Does this storagefile folder follow the convention?"  |
 * | dbx_notification_m_validate_app     | Verification  | "Is every app notification wired end-to-end?"          |
 * | dbx_notification_m_list_app         | Discovery     | "What notifications does this app configure?"          |
 * | dbx_notification_m_validate_folder  | Verification  | "Does this notification folder follow the convention?" |
 * | dbx_system_m_validate_folder        | Verification  | "Is this system folder set up correctly?"              |
 * | dbx_action_lookup                   | Documentation | "Tell me about action directive / state X"             |
 * | dbx_action_examples                 | Working code  | "Show me how to wire an action like X"                 |
 * | dbx_action_scaffold                 | Generation    | "Scaffold the action stack for use case X"             |
 * | dbx_route_tree                      | Discovery     | "What states does this app expose?"                    |
 * | dbx_route_lookup                    | Documentation | "What's the route definition for X?"                   |
 * | dbx_route_search                    | Discovery     | "Where do we have routes mentioning X?"                |
 * | dbx_filter_lookup                   | Documentation | "Tell me about filter directive / preset X"            |
 * | dbx_filter_scaffold                 | Generation    | "Scaffold a filter source + presets for model X"       |
 * | dbx_pipe_lookup                     | Documentation | "Tell me about Angular pipe X"                         |
 * | dbx_artifact_scaffold               | Generation    | "Give me the body for a new <artifact>."               |
 * | dbx_artifact_file_convention        | Reference     | "Where do I put a new <artifact>?"                     |
 * | dbx_explain_rule                    | Reference     | "Explain validation rule X — when does it apply?"      |
 * | dbx_app_validate                    | Verification  | "Validate the whole app (component + API) end-to-end." |
 * | dbx_model_list_component            | Discovery     | "What downstream models live in this `-firebase` component?" |
 * | dbx_server_actions_list_app         | Discovery     | "What server-actions classes does this API expose, and are they wired?" |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLookupFormTool } from './lookup-form.tool.js';
import { createSearchFormTool } from './search-form.tool.js';
import { formExamplesTool } from './form-examples.tool.js';
import { createFormScaffoldTool } from './form-scaffold.tool.js';
import { createLookupUiTool } from './lookup-ui.tool.js';
import { createSearchUiTool } from './search-ui.tool.js';
import { uiExamplesTool } from './ui-examples.tool.js';
import { lookupModelTool } from './lookup-model.tool.js';
import { searchModelTool } from './search-model.tool.js';
import { modelDecodeTool } from './model-decode.tool.js';
import { modelValidateTool } from './model-validate.tool.js';
import { modelValidateApiTool } from './model-validate-api.tool.js';
import { modelValidateFolderTool } from './model-validate-folder.tool.js';
import { modelStoreScaffoldTool } from './model-store-scaffold.tool.js';
import { modelFixtureListAppTool } from './model-fixture-list-app.tool.js';
import { modelFixtureLookupTool } from './model-fixture-lookup.tool.js';
import { createModelFixtureValidateAppTool } from './model-fixture-validate-app.tool.js';
import { modelFixtureScaffoldTool } from './model-fixture-scaffold.tool.js';
import { modelFixtureForwardTool } from './model-fixture-forward.tool.js';
import type { FixtureModelRegistry } from './model-fixture-shared/index.js';
import { storageFileMValidateAppTool } from './storagefile-m-validate-app.tool.js';
import { storageFileMListAppTool } from './storagefile-m-list-app.tool.js';
import { storageFileMValidateFolderTool } from './storagefile-m-validate-folder.tool.js';
import { notificationMValidateAppTool } from './notification-m-validate-app.tool.js';
import { notificationMListAppTool } from './notification-m-list-app.tool.js';
import { notificationMValidateFolderTool } from './notification-m-validate-folder.tool.js';
import { systemMValidateFolderTool } from './system-m-validate-folder.tool.js';
import { createLookupActionTool } from './lookup-action.tool.js';
import { actionExamplesTool } from './action-examples.tool.js';
import { actionScaffoldTool } from './action-scaffold.tool.js';
import { routeTreeTool } from './route-tree.tool.js';
import { routeLookupTool } from './route-lookup.tool.js';
import { routeSearchTool } from './route-search.tool.js';
import { createLookupFilterTool } from './lookup-filter.tool.js';
import { filterScaffoldTool } from './filter-scaffold.tool.js';
import { createLookupPipeTool } from './lookup-pipe.tool.js';
import { artifactScaffoldTool } from './artifact-scaffold.tool.js';
import { artifactFileConventionTool } from './artifact-file-convention.tool.js';
import { explainRuleTool } from './explain-rule.tool.js';
import { appValidateTool } from './app-validate.tool.js';
import { modelListComponentTool } from './model-list-component.tool.js';
import { serverActionsListAppTool } from './server-actions-list-app.tool.js';
import { createSemanticTypeLookupTool } from './lookup-semantic-type.tool.js';
import { createSemanticTypeSearchTool } from './search-semantic-type.tool.js';
import type { ActionRegistry } from '../registry/actions-runtime.js';
import type { FilterRegistry } from '../registry/filters-runtime.js';
import type { ForgeFieldRegistry } from '../registry/forge-fields.js';
import type { PipeRegistry } from '../registry/pipes-runtime.js';
import type { SemanticTypeRegistry } from '../registry/semantic-types.js';
import type { UiComponentRegistry } from '../registry/ui-components-runtime.js';
import { toolError, type DbxTool } from './types.js';

/**
 * Every registered tool in order of presentation in `tools/list`.
 *
 * Order clusters tools by domain so callers see related entries together:
 * form → ui → model → storagefile_m → notification_m → system_m → action →
 * route → filter → pipe → artifact. The `_m` clusters are model extensions
 * that walk an app's source tree to verify end-to-end model wiring.
 */
export const DBX_TOOLS: readonly DbxTool[] = [
  // form
  formExamplesTool,
  // ui
  uiExamplesTool,
  // model
  lookupModelTool,
  searchModelTool,
  modelDecodeTool,
  modelValidateTool,
  modelValidateApiTool,
  modelValidateFolderTool,
  modelStoreScaffoldTool,
  modelFixtureListAppTool,
  modelFixtureLookupTool,
  modelFixtureScaffoldTool,
  modelFixtureForwardTool,
  // storagefile_m (model extension)
  storageFileMValidateAppTool,
  storageFileMListAppTool,
  storageFileMValidateFolderTool,
  // notification_m (model extension)
  notificationMValidateAppTool,
  notificationMListAppTool,
  notificationMValidateFolderTool,
  // system_m (model extension)
  systemMValidateFolderTool,
  // action
  actionExamplesTool,
  actionScaffoldTool,
  // route
  routeTreeTool,
  routeLookupTool,
  routeSearchTool,
  // filter
  filterScaffoldTool,
  // artifact (cross-domain dispatchers)
  artifactScaffoldTool,
  artifactFileConventionTool,
  // rule catalog (cross-domain reference)
  explainRuleTool,
  // aggregate orchestrator
  appValidateTool,
  // downstream component introspection
  modelListComponentTool,
  serverActionsListAppTool
];

/**
 * Options consumed by {@link registerTools}. Registries are loaded
 * asynchronously at server startup, so registry-bound tools (semantic-types,
 * form fields) receive their registry via this options bag rather than from a
 * module-level static. When a registry is not supplied (e.g. tests that
 * exercise other tools) the dependent tools are not registered.
 */
export interface RegisterToolsOptions {
  readonly semanticTypeRegistry?: SemanticTypeRegistry;
  readonly forgeFieldRegistry?: ForgeFieldRegistry;
  readonly pipeRegistry?: PipeRegistry;
  readonly uiComponentRegistry?: UiComponentRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
  /**
   * Optional fixture-model registry consumed by `dbx_model_fixture_validate_app`'s
   * parent-field-naming and registry cross-reference rules. When omitted those
   * rules are skipped — the tool still validates forwarding and structural
   * concerns without it.
   */
  readonly fixtureModelRegistry?: FixtureModelRegistry;
}

/**
 * Wires `tools/list` and `tools/call` against the underlying MCP server using
 * a single shared dispatch table. Each tool surfaces its own definition and a
 * pure handler — the dispatcher routes calls by name and converts thrown
 * errors into `isError` tool results.
 *
 * @param server - the MCP server whose underlying transport handlers to register
 * @param options - optional registry handles passed to tool factories
 */
export function registerTools(server: McpServer, options: RegisterToolsOptions = {}): void {
  const underlyingServer = server.server;

  const tools: DbxTool[] = [...DBX_TOOLS];
  tools.push(createModelFixtureValidateAppTool({ getRegistry: () => options.fixtureModelRegistry }));
  if (options.forgeFieldRegistry !== undefined) {
    tools.push(createLookupFormTool({ registry: options.forgeFieldRegistry }), createSearchFormTool({ registry: options.forgeFieldRegistry }), createFormScaffoldTool({ registry: options.forgeFieldRegistry }));
  }
  if (options.semanticTypeRegistry !== undefined) {
    tools.push(createSemanticTypeLookupTool({ registry: options.semanticTypeRegistry }), createSemanticTypeSearchTool({ registry: options.semanticTypeRegistry }));
  }
  if (options.pipeRegistry !== undefined) {
    tools.push(createLookupPipeTool({ registry: options.pipeRegistry }));
  }
  if (options.uiComponentRegistry !== undefined) {
    tools.push(createLookupUiTool({ registry: options.uiComponentRegistry }), createSearchUiTool({ registry: options.uiComponentRegistry }));
  }
  if (options.actionRegistry !== undefined) {
    tools.push(createLookupActionTool({ registry: options.actionRegistry }));
  }
  if (options.filterRegistry !== undefined) {
    tools.push(createLookupFilterTool({ registry: options.filterRegistry }));
  }

  underlyingServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((t) => t.definition) };
  });

  underlyingServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    const tool = tools.find((t) => t.definition.name === name);
    if (!tool) {
      return toolError(`Unknown tool: ${name}. Known tools: ${tools.map((t) => t.definition.name).join(', ')}.`);
    }
    return tool.run(toolArgs);
  });
}
