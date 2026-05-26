/**
 * Arktype schema for the `pipes` section of `dbx-mcp.scan.json`.
 *
 * Pipes scanning lives next to the existing semantic-types, ui-components,
 * and forge-fields sections — all use the same `dbx-mcp.scan.json`
 * filename so a project that opts into multiple pipelines keeps a single
 * config file. The CLI subcommand `scan-pipes` reads only the `pipes`
 * field; sibling subcommands continue to read their own top-level fields
 * unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one pipes scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every produced
 * entry. Both default to the project's `package.json#name` when omitted.
 */
export const PipesScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link PipesScanSection}.
 */
export type PipesScanSection = typeof PipesScanSection.infer;

/**
 * Top-level shape used by the pipes builder. Only the `pipes` key is
 * consumed; the rest of the document is ignored so a single
 * `dbx-mcp.scan.json` can house all the scan sections side-by-side.
 */
export const PipesScanConfig = type({
  version: '1',
  pipes: PipesScanSection
});

/**
 * Static type inferred from {@link PipesScanConfig}.
 */
export type PipesScanConfig = typeof PipesScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_PIPES_SCAN_OUT_PATH = 'pipes.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the pipes CLI does not have to import from a sibling scan config module.
 */
export const PIPES_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
