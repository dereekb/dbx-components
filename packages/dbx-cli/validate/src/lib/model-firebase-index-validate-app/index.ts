/**
 * Public surface of the `model-firebase-index-validate-app` cluster that lives
 * in this package: only the violation-code enum, which the rule-catalog
 * generator scans (`codes.ts`) and `dbx_explain_rule` surfaces.
 *
 * The warning-mapping helpers and report types
 * (`mapModelFirebaseIndexBuildWarning`, `buildFirebaseIndexValidateAppViolation`,
 * `ModelFirebaseIndexValidateAppReport`, …) stay in `@dereekb/dbx-components-mcp`
 * next to the `dbx_model_firebase_index_validate_app` tool wrapper, because they
 * depend on `@dereekb/dbx-cli/firestore-indexes` — an in-repo source-only module
 * tangled with the `@dereekb/dbx-cli` root that cannot resolve to a built `.d.ts`
 * during this package's declaration build.
 */

export { ModelFirebaseIndexValidateAppCode, type ModelFirebaseIndexValidateAppCodeString } from './codes.js';
