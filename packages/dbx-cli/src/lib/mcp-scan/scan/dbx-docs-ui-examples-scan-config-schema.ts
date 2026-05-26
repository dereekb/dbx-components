/**
 * Arktype schema for the `dbxDocsUiExamples` section of `dbx-mcp.scan.json`.
 *
 * Mirrors the `uiComponents` cluster contract — same `dbx-mcp.scan.json`
 * filename, same `include`/`exclude`/`out`/`source`/`module` shape — so a
 * project that wants to ship downstream-app UI examples alongside any other
 * scan cluster keeps a single config file. The CLI subcommand
 * `scan-dbx-docs-ui-examples` reads only the `dbxDocsUiExamples` field; other
 * cluster CLIs continue to read their respective sections unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one dbx-docs-ui-examples scan run. `source` becomes
 * the manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the entry-level `module` field attached to every
 * produced entry. Both default to the project's `package.json#name` when
 * omitted.
 */
export const DbxDocsUiExamplesScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link DbxDocsUiExamplesScanSection}.
 */
export type DbxDocsUiExamplesScanSection = typeof DbxDocsUiExamplesScanSection.infer;

/**
 * Top-level shape used by the dbx-docs-ui-examples builder. Only the
 * `dbxDocsUiExamples` key is consumed; the rest of the document is ignored so
 * a single `dbx-mcp.scan.json` can house multiple cluster configurations.
 */
export const DbxDocsUiExamplesScanConfig = type({
  version: '1',
  dbxDocsUiExamples: DbxDocsUiExamplesScanSection
});

/**
 * Static type inferred from {@link DbxDocsUiExamplesScanConfig}.
 */
export type DbxDocsUiExamplesScanConfig = typeof DbxDocsUiExamplesScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_DBX_DOCS_UI_EXAMPLES_SCAN_OUT_PATH = 'dbx-docs-ui-examples.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`.
 */
export const DBX_DOCS_UI_EXAMPLES_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
