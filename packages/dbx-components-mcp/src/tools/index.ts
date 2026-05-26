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
 * | dbx_model_hierarchy                 | Discovery     | "Show the full Firestore model tree (parents/children)." |
 * | dbx_model_decode                    | Decoding      | "What does this Firestore doc mean?"                   |
 * | dbx_model_validate                  | Verification  | "Is this Firestore model file correct?"                |
 * | dbx_model_validate_api              | Verification  | "Is this model api file correct?"                      |
 * | dbx_model_api_list_app              | Discovery     | "What CRUD/standalone API calls does this component declare?" |
 * | dbx_model_api_lookup                | Documentation | "Tell me about the API calls for model X — params, action JSDoc." |
 * | dbx_model_api_validate_app          | Verification  | "Are all declared CRUD calls wired in this app's callModel map?" |
 * | dbx_model_validate_folder           | Verification  | "Does this model folder have the 5 files?"             |
 * | dbx_model_store_scaffold            | Generation    | "Scaffold the 4 store files for model X"               |
 * | dbx_model_fixture_list_app          | Discovery     | "What fixture/instance pairs does this app declare?"   |
 * | dbx_model_fixture_lookup            | Documentation | "Tell me about the fixture for model X"                |
 * | dbx_model_fixture_validate_app      | Verification  | "Is every fixture<->instance pair forwarded?"          |
 * | dbx_model_fixture_scaffold          | Generation    | "Add a new fixture/instance triplet for model X"       |
 * | dbx_model_fixture_forward           | Generation    | "Add the missing Fixture forwarders for instance methods" |
 * | dbx_model_test_convention           | Documentation | "Where does a new test for model X go? Pure-data lookup of the canonical path." |
 * | dbx_model_test_list_app             | Discovery     | "Inventory + drift audit of every spec in this API app."     |
 * | dbx_model_test_validate_app         | Verification  | "Enforce the model-test naming convention with severity-tagged violations." |
 * | dbx_model_test_tree                 | Discovery     | "Show me the describe/fixture structure of this spec file."  |
 * | dbx_model_test_search               | Discovery     | "Find every place this spec uses model X / chain Y."         |
 * | dbx_model_archetype_recommend       | Decision      | "Given a questionnaire, which archetype best fits this proposed model?" |
 * | dbx_model_archetype_lookup          | Documentation | "Tell me about archetype X."                                            |
 * | dbx_model_archetype_search          | Discovery     | "Find peer models that already use archetype X (optionally filtered by axes)." |
 * | dbx_storagefile_m_validate_app      | Verification  | "Is every storagefile purpose wired end-to-end?"       |
 * | dbx_storagefile_m_list_app          | Discovery     | "What storagefile purposes does this app configure?"   |
 * | dbx_storagefile_m_validate_folder   | Verification  | "Does this storagefile folder follow the convention?"  |
 * | dbx_notification_m_validate_app     | Verification  | "Is every app notification wired end-to-end?"          |
 * | dbx_notification_m_list_app         | Discovery     | "What notifications does this app configure?"          |
 * | dbx_notification_m_validate_folder  | Verification  | "Does this notification folder follow the convention?" |
 * | dbx_system_m_validate_folder        | Verification  | "Is this system folder set up correctly?"              |
 * | dbx_system_m_list_app               | Discovery     | "What system states does this component declare? Which are fully wired?" |
 * | dbx_asset_validate_app              | Verification  | "Are AssetPathRef constants wired through provideDbxAssetLoader and on disk?" |
 * | dbx_asset_list_app                  | Discovery     | "What AssetPathRef constants does this component declare?"                   |
 * | dbx_asset_validate_folder           | Verification  | "Does this component's assets.ts follow the convention?"                     |
 * | dbx_asset_scaffold                  | Generation    | "Scaffold a new AssetPathRef constant for kind X."                           |
 * | dbx_color_template_list_app         | Discovery     | "What DbxColorConfigTemplate entries does this app register?"                |
 * | dbx_color_smell_check               | Verification  | "Are there duplicate inline DbxColorConfig literals that should be templates?" |
 * | dbx_action_lookup                   | Documentation | "Tell me about action directive / state X"             |
 * | dbx_action_search                   | Discovery     | "Find action entries matching keywords"                |
 * | dbx_action_examples                 | Working code  | "Show me how to wire an action like X"                 |
 * | dbx_action_scaffold                 | Generation    | "Scaffold the action stack for use case X"             |
 * | dbx_route_tree                      | Discovery     | "What states does this app expose?"                    |
 * | dbx_route_lookup                    | Documentation | "What's the route definition for X?"                   |
 * | dbx_route_search                    | Discovery     | "Where do we have routes mentioning X?"                |
 * | dbx_route_resolve_url               | Resolution    | "What state and component owns this dev-server URL?"   |
 * | dbx_filter_lookup                   | Documentation | "Tell me about filter directive / preset X"            |
 * | dbx_filter_scaffold                 | Generation    | "Scaffold a filter source + presets for model X"       |
 * | dbx_pipe_lookup                     | Documentation | "Tell me about Angular pipe X"                         |
 * | dbx_pipe_search                     | Discovery     | "Find Angular pipes matching keywords"                 |
 * | dbx_util_lookup                     | Documentation | "Tell me about utility function/class X"               |
 * | dbx_util_search                     | Discovery     | "Find utility functions matching keywords (intent)"    |
 * | dbx_model_snapshot_field_lookup     | Documentation | "Tell me about snapshot-field factory X (firestoreDate, …)" |
 * | dbx_model_snapshot_field_search     | Discovery     | "Find snapshot-field factories by intent (date, encoded array, …)" |
 * | dbx_model_snapshot_field_list_app   | Discovery     | "Which snapshot fields does this component+app use?"   |
 * | dbx_model_firebase_index_lookup     | Documentation | "Tell me about query factory X — what indexes does it imply?" |
 * | dbx_model_firebase_index_search     | Discovery     | "Find query factories matching keywords (dirty, sync, …)" |
 * | dbx_model_firebase_index_list_app   | Discovery     | "What query factories does this component declare? Which are tagged?" |
 * | dbx_model_firebase_index_validate_app | Verification | "Does this app's firestore.indexes.json match what its factories require?" |
 * | dbx_artifact_scaffold               | Generation    | "Give me the body for a new <artifact>."               |
 * | dbx_artifact_file_convention        | Reference     | "Where do I put a new <artifact>?"                     |
 * | dbx_css_token_lookup                | Documentation | "What's the canonical CSS token for X?" (intent/value/role)|
 * | dbx_css_class_lookup                | Documentation | "Is there already a dbx-web utility class for these declarations / this intent?" |
 * | dbx_ui_smell_check                  | Verification  | "Did my new component re-implement an existing primitive?" |
 * | dbx_explain_rule                    | Reference     | "Explain validation rule X — when does it apply?"      |
 * | dbx_app_validate                    | Verification  | "Validate the whole app (component + API) end-to-end." |
 * | dbx_model_list_component            | Discovery     | "What downstream models live in this `-firebase` component?" |
 * | dbx_server_actions_list_app         | Discovery     | "What server-actions classes does this API expose, and are they wired?" |
 * | dbx_mcp_config                      | Setup         | "Status / validate / init / refresh the workspace dbx-mcp config." |
 * | dbx_auth_claim_lookup               | Documentation | "Tell me about claim key / `*ApiAuthClaims` interface X." |
 * | dbx_auth_scope_lookup               | Documentation | "Tell me about OIDC scope X — where is it enforced?"      |
 * | dbx_auth_role_lookup                | Documentation | "Forward / tag / reverse role lookup."                    |
 * | dbx_auth_token_explain              | Decoding      | "Decode this JWT and annotate every claim."               |
 * | dbx_auth_list_app                   | Discovery     | "Enumerate one app's claims, scopes, and gates."         |
 * | dbx_log_search                      | Discovery     | "Search per-change markdown logs (fuzzy/keyword/list)."  |
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLookupFormTool } from './lookup-form.tool.js';
import { createSearchFormTool } from './search-form.tool.js';
import { FORM_EXAMPLES_TOOL } from './form-examples.tool.js';
import { createFormScaffoldTool } from './form-scaffold.tool.js';
import { createLookupUiTool } from './lookup-ui.tool.js';
import { createSearchUiTool } from './search-ui.tool.js';
import { createUiExamplesTool } from './ui-examples.tool.js';
import { LOOKUP_MODEL_TOOL } from './lookup-model.tool.js';
import { SEARCH_MODEL_TOOL } from './search-model.tool.js';
import { MODEL_DECODE_TOOL } from './model-decode.tool.js';
import { createModelValidateTool } from './model-validate.tool.js';
import type { RuleOptions } from './model-validate/index.js';
import { modelValidateApiTool } from './model-validate-api.tool.js';
import { MODEL_API_LIST_APP_TOOL } from './model-api-list-app.tool.js';
import { MODEL_API_LOOKUP_TOOL } from './model-api-lookup.tool.js';
import { MODEL_API_VALIDATE_APP_TOOL } from './model-api-validate-app.tool.js';
import { createModelValidateFolderTool } from './model-validate-folder.tool.js';
import { MODEL_STORE_SCAFFOLD_TOOL } from './model-store-scaffold.tool.js';
import { MODEL_FIXTURE_LIST_APP_TOOL } from './model-fixture-list-app.tool.js';
import { MODEL_FIXTURE_LOOKUP_TOOL } from './model-fixture-lookup.tool.js';
import { createModelFixtureValidateAppTool } from './model-fixture-validate-app.tool.js';
import { MODEL_FIXTURE_SCAFFOLD_TOOL } from './model-fixture-scaffold.tool.js';
import { MODEL_FIXTURE_FORWARD_TOOL } from './model-fixture-forward.tool.js';
import { MODEL_TEST_LIST_APP_TOOL } from './model-test-list-app.tool.js';
import { MODEL_TEST_TREE_TOOL } from './model-test-tree.tool.js';
import { MODEL_TEST_SEARCH_TOOL } from './model-test-search.tool.js';
import { MODEL_TEST_CONVENTION_TOOL } from './model-test-convention.tool.js';
import { MODEL_TEST_VALIDATE_APP_TOOL } from './model-test-validate-app.tool.js';
import { ARCHETYPE_RECOMMEND_TOOL } from './archetype-recommend.tool.js';
import { ARCHETYPE_LOOKUP_TOOL } from './archetype-lookup.tool.js';
import { ARCHETYPE_SEARCH_TOOL } from './archetype-search.tool.js';
import { MODEL_HIERARCHY_TOOL } from './model-hierarchy.tool.js';
import type { FixtureModelRegistry } from './model-fixture-shared/index.js';
import { storageFileMValidateAppTool } from './storagefile-m-validate-app.tool.js';
import { storageFileMListAppTool } from './storagefile-m-list-app.tool.js';
import { storageFileMValidateFolderTool } from './storagefile-m-validate-folder.tool.js';
import { notificationMValidateAppTool } from './notification-m-validate-app.tool.js';
import { notificationMListAppTool } from './notification-m-list-app.tool.js';
import { notificationMValidateFolderTool } from './notification-m-validate-folder.tool.js';
import { systemMValidateFolderTool } from './system-m-validate-folder.tool.js';
import { SYSTEM_M_LIST_APP_TOOL } from './system-m-list-app.tool.js';
import { dbxAssetValidateAppTool } from './dbx-asset-validate-app.tool.js';
import { dbxAssetListAppTool } from './dbx-asset-list-app.tool.js';
import { dbxAssetValidateFolderTool } from './dbx-asset-validate-folder.tool.js';
import { DBX_ASSET_SCAFFOLD_TOOL } from './dbx-asset-scaffold.tool.js';
import { DBX_COLOR_TEMPLATE_LIST_APP_TOOL } from './dbx-color-template-list-app.tool.js';
import { DBX_COLOR_SMELL_CHECK_TOOL } from './dbx-color-smell-check.tool.js';
import { createLookupActionTool } from './lookup-action.tool.js';
import { createSearchActionTool } from './search-action.tool.js';
import { ACTION_EXAMPLES_TOOL } from './action-examples.tool.js';
import { ACTION_SCAFFOLD_TOOL } from './action-scaffold.tool.js';
import { ROUTE_TREE_TOOL } from './route-tree.tool.js';
import { ROUTE_LOOKUP_TOOL } from './route-lookup.tool.js';
import { ROUTE_SEARCH_TOOL } from './route-search.tool.js';
import { ROUTE_RESOLVE_URL_TOOL } from './route-resolve-url.tool.js';
import { createLookupFilterTool } from './lookup-filter.tool.js';
import { FILTER_SCAFFOLD_TOOL } from './filter-scaffold.tool.js';
import { createLookupPipeTool } from './lookup-pipe.tool.js';
import { createSearchPipeTool } from './search-pipe.tool.js';
import { createLookupUtilTool } from './lookup-util.tool.js';
import { createSearchUtilTool } from './search-util.tool.js';
import { createLookupModelSnapshotFieldTool } from './lookup-model-snapshot-field.tool.js';
import { createSearchModelSnapshotFieldTool } from './search-model-snapshot-field.tool.js';
import { createListAppModelSnapshotFieldsTool } from './list-app-model-snapshot-fields.tool.js';
import { createLookupModelFirebaseIndexTool } from './lookup-model-firebase-index.tool.js';
import { createSearchModelFirebaseIndexTool } from './search-model-firebase-index.tool.js';
import { createListAppModelFirebaseIndexTool } from './list-app-model-firebase-index.tool.js';
import { createValidateAppModelFirebaseIndexTool } from './validate-app-model-firebase-index.tool.js';
import { ARTIFACT_SCAFFOLD_TOOL } from './artifact-scaffold.tool.js';
import { ARTIFACT_FILE_CONVENTION_TOOL } from './artifact-file-convention.tool.js';
import { EXPLAIN_RULE_TOOL } from './explain-rule.tool.js';
import { APP_VALIDATE_TOOL } from './app-validate.tool.js';
import { MODEL_LIST_COMPONENT_TOOL } from './model-list-component.tool.js';
import { SERVER_ACTIONS_LIST_APP_TOOL } from './server-actions-list-app.tool.js';
import { MCP_CONFIG_TOOL } from './mcp-config.tool.js';
import { createLogSearchTool, type LogSearchConfig } from './log-search.tool.js';
import { createSemanticTypeLookupTool } from './lookup-semantic-type.tool.js';
import { createSemanticTypeSearchTool } from './search-semantic-type.tool.js';
import { createCssTokenLookupTool } from './css-token-lookup.tool.js';
import { createCssClassLookupTool } from './css-class-lookup.tool.js';
import { createUiSmellCheckTool } from './ui-smell-check.tool.js';
import { createAuthClaimLookupTool } from './auth-claim-lookup.tool.js';
import { createAuthScopeLookupTool } from './auth-scope-lookup.tool.js';
import { createAuthRoleLookupTool } from './auth-role-lookup.tool.js';
import { createAuthTokenExplainTool } from './auth-token-explain.tool.js';
import { createAuthListAppTool } from './auth-list-app.tool.js';
import { type ActionRegistry, type AuthRegistry, type FilterRegistry, type ForgeFieldRegistry, type PipeRegistry, type UtilRegistry, type ModelSnapshotFieldRegistry, type SemanticTypeRegistry, type TokenRegistry, type CssUtilityRegistry, type UiComponentRegistry, type DbxDocsUiExamplesRegistry } from '@dereekb/dbx-cli';
import type { ModelFirebaseIndexRegistry } from '@dereekb/dbx-cli/firestore-indexes';
import { toolError, type DbxTool } from './types.js';

/**
 * Every registered tool in order of presentation in `tools/list`.
 *
 * Order clusters tools by domain so callers see related entries together:
 * form → ui → model → storagefile_m → notification_m → system_m → asset →
 * action → route → filter → pipe → artifact. The `_m` clusters are model
 * extensions that walk an app's source tree to verify end-to-end model
 * wiring; the `asset` cluster walks the component + Angular app pair to
 * verify `AssetPathRef` wiring.
 */
export const DBX_TOOLS: readonly DbxTool[] = [
  // form
  FORM_EXAMPLES_TOOL,
  // model
  LOOKUP_MODEL_TOOL,
  SEARCH_MODEL_TOOL,
  MODEL_HIERARCHY_TOOL,
  MODEL_DECODE_TOOL,
  modelValidateApiTool,
  MODEL_API_LIST_APP_TOOL,
  MODEL_API_LOOKUP_TOOL,
  MODEL_API_VALIDATE_APP_TOOL,
  MODEL_STORE_SCAFFOLD_TOOL,
  MODEL_FIXTURE_LIST_APP_TOOL,
  MODEL_FIXTURE_LOOKUP_TOOL,
  MODEL_FIXTURE_SCAFFOLD_TOOL,
  MODEL_FIXTURE_FORWARD_TOOL,
  MODEL_TEST_CONVENTION_TOOL,
  MODEL_TEST_LIST_APP_TOOL,
  MODEL_TEST_VALIDATE_APP_TOOL,
  MODEL_TEST_TREE_TOOL,
  MODEL_TEST_SEARCH_TOOL,
  ARCHETYPE_RECOMMEND_TOOL,
  ARCHETYPE_LOOKUP_TOOL,
  ARCHETYPE_SEARCH_TOOL,
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
  SYSTEM_M_LIST_APP_TOOL,
  // asset (component + app extension)
  dbxAssetValidateAppTool,
  dbxAssetListAppTool,
  dbxAssetValidateFolderTool,
  DBX_ASSET_SCAFFOLD_TOOL,
  // color (Angular app extension)
  DBX_COLOR_TEMPLATE_LIST_APP_TOOL,
  DBX_COLOR_SMELL_CHECK_TOOL,
  // action
  ACTION_EXAMPLES_TOOL,
  ACTION_SCAFFOLD_TOOL,
  // route
  ROUTE_TREE_TOOL,
  ROUTE_LOOKUP_TOOL,
  ROUTE_SEARCH_TOOL,
  ROUTE_RESOLVE_URL_TOOL,
  // filter
  FILTER_SCAFFOLD_TOOL,
  // artifact (cross-domain dispatchers)
  ARTIFACT_SCAFFOLD_TOOL,
  ARTIFACT_FILE_CONVENTION_TOOL,
  // rule catalog (cross-domain reference)
  EXPLAIN_RULE_TOOL,
  // aggregate orchestrator
  APP_VALIDATE_TOOL,
  // downstream component introspection
  MODEL_LIST_COMPONENT_TOOL,
  SERVER_ACTIONS_LIST_APP_TOOL,
  // workspace config audit / setup
  MCP_CONFIG_TOOL
];

/**
 * Auth-cluster tools registered when an {@link AuthRegistry} is supplied.
 * Bundled separately from {@link DBX_TOOLS} because the registry is
 * loaded asynchronously and tests exercise the cluster in isolation.
 *
 * @param registry - Pre-merged auth registry shared across the cluster's lookup tools.
 * @returns The set of registry-bound auth tools (`auth_claim_lookup`, `auth_scope_lookup`, `auth_role_lookup`, `auth_token_explain`, `auth_list_app`).
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthClusterTools(registry: AuthRegistry): readonly DbxTool[] {
  return [createAuthClaimLookupTool({ registry }), createAuthScopeLookupTool({ registry }), createAuthRoleLookupTool({ registry }), createAuthTokenExplainTool({ registry }), createAuthListAppTool({ registry })];
}

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
  readonly utilRegistry?: UtilRegistry;
  /**
   * Optional model-snapshot-fields registry. Required for the
   * `dbx_model_snapshot_field_*` cluster (lookup, search, list_app); when
   * omitted those tools are skipped.
   */
  readonly modelSnapshotFieldRegistry?: ModelSnapshotFieldRegistry;
  /**
   * Optional model-firebase-index registry. Required for the
   * `dbx_model_firebase_index_*` cluster (currently: lookup); when
   * omitted those tools are skipped.
   */
  readonly modelFirebaseIndexRegistry?: ModelFirebaseIndexRegistry;
  readonly uiComponentRegistry?: UiComponentRegistry;
  /**
   * Optional app-sourced UI examples registry. When supplied (or empty),
   * `dbx_ui_examples` is wired to merge curated `UI_PATTERNS` with scanned
   * entries; `dbx_ui_search` is wired to surface a "Related examples"
   * section when component hits overlap an example's `relatedSlugs`.
   */
  readonly dbxDocsUiExamplesRegistry?: DbxDocsUiExamplesRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
  /**
   * Optional token registry. Required for `dbx_css_token_lookup` and
   * `dbx_ui_smell_check`; when omitted those tools are skipped.
   */
  readonly tokenRegistry?: TokenRegistry;
  /**
   * Optional css-utility registry. Required for `dbx_css_class_lookup`;
   * when omitted that tool is skipped.
   */
  readonly cssUtilityRegistry?: CssUtilityRegistry;
  /**
   * Working directory used by `dbx_ui_smell_check` to resolve
   * `dbx-mcp.config.json` for project convention overrides.
   */
  readonly cwd?: string;
  /**
   * Optional fixture-model registry consumed by `dbx_model_fixture_validate_app`'s
   * parent-field-naming and registry cross-reference rules. When omitted those
   * rules are skipped — the tool still validates forwarding and structural
   * concerns without it.
   */
  readonly fixtureModelRegistry?: FixtureModelRegistry;
  /**
   * Optional rule overrides for `dbx_model_validate`, resolved at server
   * bootstrap from the workspace's `dbx-mcp.config.json` `modelValidate`
   * block. When omitted, the validator runs with built-in defaults.
   */
  readonly modelValidateRuleOptions?: RuleOptions;
  /**
   * Optional auth catalog registry consumed by the `dbx_auth_*` tool
   * cluster (claim/scope/role lookup, JWT explainer, app surface). When
   * omitted those tools are skipped.
   */
  readonly authRegistry?: AuthRegistry;
  /**
   * Optional `logs` block resolved from `dbx-mcp.config.json`. Provides a
   * workspace-level fallback for `dbx_log_search` when neither a per-call
   * `basePath` nor `DBX_LOG_PATH` is set. `basePath` should already be
   * absolute (the bootstrap resolves it against the config file's directory).
   */
  readonly logSearchConfig?: LogSearchConfig;
}

/**
 * Wires `tools/list` and `tools/call` against the underlying MCP server using
 * a single shared dispatch table. Each tool surfaces its own definition and a
 * pure handler — the dispatcher routes calls by name and converts thrown
 * errors into `isError` tool results.
 *
 * @param server - The MCP server whose underlying transport handlers to register.
 * @param options - Optional registry handles passed to tool factories.
 */
export function registerTools(server: McpServer, options: RegisterToolsOptions = {}): void {
  const underlyingServer = server.server;

  const tools: DbxTool[] = [...DBX_TOOLS];
  tools.push(createUiExamplesTool({ examplesRegistry: options.dbxDocsUiExamplesRegistry }), createModelValidateTool({ ruleOptions: options.modelValidateRuleOptions }), createModelValidateFolderTool({ ruleOptions: options.modelValidateRuleOptions }), createModelFixtureValidateAppTool({ getRegistry: () => options.fixtureModelRegistry }), createLogSearchTool(options.logSearchConfig));
  if (options.forgeFieldRegistry !== undefined) {
    tools.push(createLookupFormTool({ registry: options.forgeFieldRegistry }), createSearchFormTool({ registry: options.forgeFieldRegistry }), createFormScaffoldTool({ registry: options.forgeFieldRegistry }));
  }
  if (options.semanticTypeRegistry !== undefined) {
    tools.push(createSemanticTypeLookupTool({ registry: options.semanticTypeRegistry }), createSemanticTypeSearchTool({ registry: options.semanticTypeRegistry }));
  }
  if (options.pipeRegistry !== undefined) {
    tools.push(createLookupPipeTool({ registry: options.pipeRegistry }), createSearchPipeTool({ registry: options.pipeRegistry }));
  }
  if (options.utilRegistry !== undefined) {
    tools.push(createLookupUtilTool({ registry: options.utilRegistry }), createSearchUtilTool({ registry: options.utilRegistry }));
  }
  if (options.modelSnapshotFieldRegistry !== undefined) {
    tools.push(createLookupModelSnapshotFieldTool({ registry: options.modelSnapshotFieldRegistry }), createSearchModelSnapshotFieldTool({ registry: options.modelSnapshotFieldRegistry }), createListAppModelSnapshotFieldsTool({ registry: options.modelSnapshotFieldRegistry }));
  }
  if (options.modelFirebaseIndexRegistry !== undefined) {
    tools.push(createLookupModelFirebaseIndexTool({ registry: options.modelFirebaseIndexRegistry }), createSearchModelFirebaseIndexTool({ registry: options.modelFirebaseIndexRegistry }), createListAppModelFirebaseIndexTool(), createValidateAppModelFirebaseIndexTool());
  }
  if (options.uiComponentRegistry !== undefined) {
    tools.push(createLookupUiTool({ registry: options.uiComponentRegistry }), createSearchUiTool({ registry: options.uiComponentRegistry, examplesRegistry: options.dbxDocsUiExamplesRegistry }));
  }
  if (options.actionRegistry !== undefined) {
    tools.push(createLookupActionTool({ registry: options.actionRegistry }), createSearchActionTool({ registry: options.actionRegistry }));
  }
  if (options.filterRegistry !== undefined) {
    tools.push(createLookupFilterTool({ registry: options.filterRegistry }));
  }
  if (options.tokenRegistry !== undefined) {
    tools.push(createCssTokenLookupTool({ registry: options.tokenRegistry }));
    if (options.uiComponentRegistry !== undefined) {
      tools.push(createUiSmellCheckTool({ tokenRegistry: options.tokenRegistry, uiComponentRegistry: options.uiComponentRegistry, cwd: options.cwd }));
    }
  }
  if (options.cssUtilityRegistry !== undefined) {
    tools.push(createCssClassLookupTool({ registry: options.cssUtilityRegistry }));
  }
  if (options.authRegistry !== undefined) {
    tools.push(...createAuthClusterTools(options.authRegistry));
  }

  underlyingServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map((t) => t.definition) };
  });

  underlyingServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    const tool = tools.find((t) => t.definition.name === name);
    return tool ? tool.run(toolArgs) : toolError(`Unknown tool: ${name}. Known tools: ${tools.map((t) => t.definition.name).join(', ')}.`);
  });
}
