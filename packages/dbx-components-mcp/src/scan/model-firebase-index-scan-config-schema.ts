/**
 * Arktype schema for the `modelFirebaseIndex` section of `dbx-mcp.scan.json`.
 *
 * Mirrors the existing `modelSnapshotFields` section — same `dbx-mcp.scan.json`
 * filename so a project that opts into multiple pipelines keeps a single
 * config file. The CLI subcommand `scan-model-firebase-indexes` reads only
 * the `modelFirebaseIndex` field; sibling subcommands continue to read their
 * own top-level fields unchanged.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one model-firebase-index scan run. `source`
 * becomes the manifest's `source` label (used for collision detection across
 * loaded sources); `module` becomes the npm package name attached to every
 * produced entry. Both default to the project's `package.json#name` when
 * omitted.
 */
export const ModelFirebaseIndexScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type for {@link ModelFirebaseIndexScanSection}.
 */
export type ModelFirebaseIndexScanSection = typeof ModelFirebaseIndexScanSection.infer;

/**
 * Top-level shape used by the model-firebase-index builder. Only the
 * `modelFirebaseIndex` key is consumed; the rest of the document is ignored
 * so a single `dbx-mcp.scan.json` can house all the scan sections
 * side-by-side.
 */
export const ModelFirebaseIndexScanConfig = type({
  version: '1',
  modelFirebaseIndex: ModelFirebaseIndexScanSection
});

/**
 * Static type for {@link ModelFirebaseIndexScanConfig}.
 */
export type ModelFirebaseIndexScanConfig = typeof ModelFirebaseIndexScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_MODEL_FIREBASE_INDEX_SCAN_OUT_PATH = 'model-firebase-index.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the model-firebase-index CLI does not have to import from a sibling scan
 * config module.
 */
export const MODEL_FIREBASE_INDEX_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
