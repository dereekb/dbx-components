/**
 * Arktype schema for the `forgeFields` section of `dbx-mcp.scan.json`.
 *
 * Forge-field scanning lives next to the existing semantic-types and
 * ui-components sections — all three use the same `dbx-mcp.scan.json`
 * filename so a project that opts into multiple pipelines keeps a single
 * config file. The CLI subcommand `scan-forge-fields` reads only the
 * `forgeFields` field; sibling subcommands continue to read their own
 * top-level fields unchanged.
 *
 * The schema is intentionally permissive at the root (extra keys are
 * preserved untouched) so semantic-types and ui-components configs can
 * coexist without cross-section validation.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one forge-fields scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every produced
 * entry. Both default to the project's `package.json#name` when omitted.
 */
export const ForgeFieldsScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link ForgeFieldsScanSection}.
 */
export type ForgeFieldsScanSection = typeof ForgeFieldsScanSection.infer;

/**
 * Top-level shape used by the forge-fields builder. Only the `forgeFields`
 * key is consumed; the rest of the document is ignored so a single
 * `dbx-mcp.scan.json` can house all the scan sections side-by-side.
 */
export const ForgeFieldsScanConfig = type({
  version: '1',
  forgeFields: ForgeFieldsScanSection
});

/**
 * Static type inferred from {@link ForgeFieldsScanConfig}.
 */
export type ForgeFieldsScanConfig = typeof ForgeFieldsScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_FORGE_FIELDS_SCAN_OUT_PATH = 'forge-fields.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the forge-fields CLI does not have to import from a sibling scan config
 * module.
 */
export const FORGE_FIELDS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
