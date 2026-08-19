/**
 * Public surface of the `model-server-only-validate-app` cluster that lives in this package: only
 * the violation-code enum, which the rule-catalog generator scans (`codes.ts`) and
 * `dbx_explain_rule` surfaces.
 *
 * The extraction + reconciliation logic stays in `@dereekb/dbx-components-mcp` next to the
 * `dbx_model_server_only_validate_app` tool wrapper, mirroring
 * `model-firebase-index-validate-app`: it depends on `@dereekb/dbx-cli/firestore-rules` and
 * `@dereekb/dbx-cli/manifest-extract`, in-repo source-only modules that cannot resolve to a built
 * `.d.ts` during this package's declaration build.
 */

export { ModelServerOnlyValidateAppCode, type ModelServerOnlyValidateAppCodeString } from './codes.js';
