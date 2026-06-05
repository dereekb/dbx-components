/**
 * Public surface of `@dereekb/dbx-cli/validate`.
 *
 * Pure, dependency-light validators, app-introspection extractors, and
 * smell-checks for a dbx-components workspace. None of this logic touches the
 * MCP SDK or yargs — it is callable three ways over one implementation:
 *
 * - `import` (dbx-claude scripts and other library consumers),
 * - MCP tool (the `dbx-components-mcp` `*.tool.ts` wrappers), and
 * - CLI command (the `dbx-components-cli` `validate` / `list` / `smell` tree).
 *
 * The consumer layers each add their own disk I/O, argument parsing, and
 * presentation (`ToolResult` shaping / cwd path-safety for MCP, yargs +
 * process-exit codes for the CLI).
 *
 * ## Shape
 *
 * The **shared violation infrastructure** (`_core`) is exported flat — the
 * rule catalog (`RULE_CATALOG`, `findRule`, `attachRemediation`, …), the
 * cwd-bounded input resolvers (`ensurePathInsideCwd`, `resolveValidatorSources`,
 * …), the violation formatters (`formatStatusLabel`, `groupViolations`, …), and
 * the two-side folder validator engine (`createTwoSideFolderValidator`).
 *
 * Each **per-domain validator / extractor / smell-check** is exported as a
 * namespace, because they share generic member names (`validate*`,
 * `formatResult`, `inspectFolder`, `ValidationResult`, `Violation`, …) that
 * would collide in a flat barrel. Import the namespace and reach through it:
 * `modelValidate.validateFirebaseModelSources(...)`.
 */

// shared violation infrastructure (collision-free, exported flat)
export * from './lib/_core/rule-catalog/index.js';
export * from './lib/_core/validate-input.js';
export * from './lib/_core/validate-format.js';
export * from './lib/_core/validate-two-side-folder.js';

// firebase-index violation codes (catalog source for `dbx_model_firebase_index_validate_app`).
// The warning-mapping helpers + report types stay in `@dereekb/dbx-components-mcp` next to
// the tool wrapper (they depend on the source-only `@dereekb/dbx-cli/firestore-indexes`).
export { ModelFirebaseIndexValidateAppCode, type ModelFirebaseIndexValidateAppCodeString } from './lib/model-firebase-index-validate-app/index.js';

// per-domain validators (namespaced to avoid generic-name collisions)
export * as modelValidate from './lib/model-validate/index.js';
export * as modelValidateApi from './lib/model-validate-api/index.js';
export * as modelValidateFolder from './lib/model-validate-folder/index.js';
export * as modelApiValidateApp from './lib/model-api-validate-app/index.js';
export * as modelTestValidateApp from './lib/model-test-validate-app/index.js';
export * as assetValidateApp from './lib/dbx-asset-validate-app/index.js';
export * as assetValidateFolder from './lib/dbx-asset-validate-folder/index.js';
export * as notificationValidateApp from './lib/notification-m-validate-app/index.js';
export * as notificationValidateFolder from './lib/notification-m-validate-folder/index.js';
export * as storagefileValidateApp from './lib/storagefile-m-validate-app/index.js';
export * as storagefileValidateFolder from './lib/storagefile-m-validate-folder/index.js';
export * as systemValidateFolder from './lib/system-m-validate-folder/index.js';
export * as fixtureValidate from './lib/model-fixture-shared/index.js';

// per-domain app-introspection extractors (list / lookup)
export * as modelListComponent from './lib/model-list-component/index.js';
export * as modelApiListApp from './lib/model-api-list-app/index.js';
export * as modelApiLookup from './lib/model-api-lookup/index.js';
export * as serverActionsListApp from './lib/server-actions-list-app/index.js';
export * as assetListApp from './lib/dbx-asset-list-app/index.js';
export * as notificationListApp from './lib/notification-m-list-app/index.js';
export * as storagefileListApp from './lib/storagefile-m-list-app/index.js';
export * as systemListApp from './lib/system-m-list-app/index.js';
export * as colorTemplateListApp from './lib/dbx-color-template-list-app/index.js';

// smell-checks
export * as colorSmellCheck from './lib/dbx-color-smell-check/index.js';
export * as uiSmellCheck from './lib/ui-smell-check/index.js';
