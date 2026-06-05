/**
 * Public surface of the `model-test-validate-app` module.
 *
 * Used by `model-test-validate-app.tool.ts` (the MCP wrapper) and by the
 * `dbx_app_validate` aggregator. Specs may import directly from here to
 * exercise the pure validator without touching the filesystem.
 */

export { ModelTestValidateAppCode, type ModelTestValidateAppCodeString } from './codes.js';
export { validateModelTestApp, type ValidateModelTestAppInput } from './validate.js';
export { formatModelTestValidateAppJson, formatModelTestValidateAppMarkdown } from './format.js';
export type { ModelTestValidateAppResult, ValidateModelTestAppOptions, Violation, ViolationCode } from './types.js';
