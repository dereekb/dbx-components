/**
 * Arktype schema for the `filters` section of `dbx-mcp.scan.json`.
 *
 * Filters scanning lives next to the existing semantic-types, ui-components,
 * forge-fields, pipes, and actions sections — all use the same
 * `dbx-mcp.scan.json` filename so a project that opts into multiple pipelines
 * keeps a single config file. The CLI subcommand `scan-filters` reads only
 * the `filters` field; sibling subcommands continue to read their own
 * top-level fields unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one filters scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every produced
 * entry. Both default to the project's `package.json#name` when omitted.
 */
export const FiltersScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link FiltersScanSection}.
 */
export type FiltersScanSection = typeof FiltersScanSection.infer;

/**
 * Top-level shape used by the filters builder. Only the `filters` key is
 * consumed; the rest of the document is ignored so a single
 * `dbx-mcp.scan.json` can house all the scan sections side-by-side.
 */
export const FiltersScanConfig = type({
  version: '1',
  filters: FiltersScanSection
});

/**
 * Static type inferred from {@link FiltersScanConfig}.
 */
export type FiltersScanConfig = typeof FiltersScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_FILTERS_SCAN_OUT_PATH = 'filters.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the filters CLI does not have to import from a sibling scan config module.
 */
export const FILTERS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
