/**
 * Scan barrel for the dbx-components MCP scan infrastructure.
 *
 * Exposes the ts-morph-backed extractors, build-manifest helpers,
 * scan-config schemas, and CLI entrypoints used by the
 * `generate-mcp-manifest`-family CLIs and by runtime resources that
 * scan workspace source for downstream models / discovery.
 */

export * from './scan-config-schema.js';
export * from './extract.js';
export * from './build-manifest.js';
export * from './cli.js';
export * from './filters-cli.js';
export * from './filters-extract.js';
export * from './filters-build-manifest.js';
export * from './filters-scan-config-schema.js';
export * from './actions-cli.js';
export * from './actions-extract.js';
export * from './actions-build-manifest.js';
export * from './actions-scan-config-schema.js';
export * from './auth-extract.js';
export * from './css-utilities-cli.js';
// css-utilities-extract.js and ui-components-extract.js both declare a
// local `ExtractWarning` union. Keep the css-utilities one on the barrel
// and re-export the ui-components one under an alias.
export * from './css-utilities-extract.js';
export * from './css-utilities-build-manifest.js';
export * from './css-utilities-scan-config-schema.js';
export * from './dbx-docs-ui-examples-cli.js';
export * from './dbx-docs-ui-examples-extract.js';
export * from './dbx-docs-ui-examples-build-manifest.js';
export * from './dbx-docs-ui-examples-scan-config-schema.js';
export * from './discover-downstream-packages.js';
export { discoverDownstreamFirebasePackages, resolveExplicitFirebasePackages } from './discover-firebase-packages.js';
export type { DownstreamFirebasePackage } from './discover-firebase-packages.js';
export * from './forge-fields-cli.js';
export * from './forge-fields-extract.js';
export * from './forge-fields-build-manifest.js';
export * from './forge-fields-scan-config-schema.js';
export * from './model-firebase-index-cli.js';
export * from './model-firebase-index-dispatcher-credit.js';
export * from './model-firebase-index-reference-scan.js';
export * from './model-snapshot-fields-cli.js';
export * from './model-snapshot-fields-extract.js';
export * from './model-snapshot-fields-build-manifest.js';
export * from './model-snapshot-fields-scan-config-schema.js';
export * from './pipes-cli.js';
export * from './pipes-extract.js';
export * from './pipes-build-manifest.js';
export * from './pipes-scan-config-schema.js';
export * from './scan-angular-io.js';
// scan-cli-base.js declares its own `RunScanCliResult` shape distinct
// from cli.js. Keep the cli.js one on the barrel and re-export the
// internal helpers explicitly (the type is consumer-irrelevant).
export { runScanCliBase, parseScanArgs } from './scan-cli-base.js';
export type { ScanCliBaseReadFile, ScanCliBaseWriteFile, ScanCliBaseLogger, ScanCliManifestLike, ScanCliBuildSuccess, ScanCliBuildFailure, ScanCliBuildOutcome, ScanCliBuildInput, ScanCliConfig, RunScanCliBaseInput } from './scan-cli-base.js';
export * from './ui-components-cli.js';
export type { ExtractedUiEntry, ExtractUiEntriesInput, ExtractUiEntriesResult, ExtractWarning as UiComponentExtractWarning } from './ui-components-extract.js';
export { extractUiEntries, ExtractedUiEntrySchema } from './ui-components-extract.js';
export * from './ui-components-build-manifest.js';
export * from './ui-components-scan-config-schema.js';
export * from './utils-cli.js';
export * from './utils-extract.js';
export * from './utils-build-manifest.js';
export * from './utils-scan-config-schema.js';
export * from './extract-models/index.js';
