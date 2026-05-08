/**
 * Arktype schema for the `modelSnapshotFields` section of `dbx-mcp.scan.json`.
 *
 * Model-snapshot-fields scanning lives next to the existing semantic-types,
 * ui-components, forge-fields, pipes, and utils sections — all use the same
 * `dbx-mcp.scan.json` filename so a project that opts into multiple
 * pipelines keeps a single config file. The CLI subcommand
 * `scan-model-snapshot-fields` reads only the `modelSnapshotFields` field;
 * sibling subcommands continue to read their own top-level fields unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one model-snapshot-fields scan run. `source`
 * becomes the manifest's `source` label (used for collision detection across
 * loaded sources); `module` becomes the npm package name attached to every
 * produced entry. Both default to the project's `package.json#name` when
 * omitted.
 */
export const ModelSnapshotFieldsScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link ModelSnapshotFieldsScanSection}.
 */
export type ModelSnapshotFieldsScanSection = typeof ModelSnapshotFieldsScanSection.infer;

/**
 * Top-level shape used by the model-snapshot-fields builder. Only the
 * `modelSnapshotFields` key is consumed; the rest of the document is ignored
 * so a single `dbx-mcp.scan.json` can house all the scan sections
 * side-by-side.
 */
export const ModelSnapshotFieldsScanConfig = type({
  version: '1',
  modelSnapshotFields: ModelSnapshotFieldsScanSection
});

/**
 * Static type inferred from {@link ModelSnapshotFieldsScanConfig}.
 */
export type ModelSnapshotFieldsScanConfig = typeof ModelSnapshotFieldsScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_MODEL_SNAPSHOT_FIELDS_SCAN_OUT_PATH = 'model-snapshot-fields.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the model-snapshot-fields CLI does not have to import from a sibling scan
 * config module.
 */
export const MODEL_SNAPSHOT_FIELDS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
