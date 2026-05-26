/**
 * Arktype schema for the `utils` section of `dbx-mcp.scan.json`.
 *
 * Utils scanning lives next to the existing semantic-types, ui-components,
 * forge-fields, and pipes sections — all use the same `dbx-mcp.scan.json`
 * filename so a project that opts into multiple pipelines keeps a single
 * config file. The CLI subcommand `scan-utils` reads only the `utils`
 * field; sibling subcommands continue to read their own top-level fields
 * unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one utils scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every
 * produced entry. Both default to the project's `package.json#name` when
 * omitted.
 */
export const UtilsScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link UtilsScanSection}.
 */
export type UtilsScanSection = typeof UtilsScanSection.infer;

/**
 * Top-level shape used by the utils builder. Only the `utils` key is
 * consumed; the rest of the document is ignored so a single
 * `dbx-mcp.scan.json` can house all the scan sections side-by-side.
 */
export const UtilsScanConfig = type({
  version: '1',
  utils: UtilsScanSection
});

/**
 * Static type inferred from {@link UtilsScanConfig}.
 */
export type UtilsScanConfig = typeof UtilsScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_UTILS_SCAN_OUT_PATH = 'utils.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the utils CLI does not have to import from a sibling scan config module.
 */
export const UTILS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
