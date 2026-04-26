/**
 * Arktype schema for `dbx-mcp.scan.json`.
 *
 * The scan config lives at the root of any package or app that wants the
 * `scan-semantic-types` generator to produce a manifest for its semantic
 * types. One scan config produces one manifest; if a workspace ships two
 * sources (e.g. `@dereekb/util` and `@dereekb/model`) each gets its own
 * scan config in its own directory.
 *
 * The schema mirrors {@link SemanticTypeManifest} where it can — `source`
 * and `topicNamespace` carry through verbatim — but also adds the inputs
 * the generator needs to actually walk source code (`include`, `exclude`)
 * and decide where to emit the manifest (`out`).
 */

import { type } from 'arktype';

/**
 * Top-level scan config schema. `include` is required; everything else
 * has a sensible default. The `declaredTopics` array advertises the
 * namespaced topics this manifest will use — entries may still emit
 * topics outside this list, but the loader uses it to decide which
 * topics show up in `topics` field of the produced manifest.
 */
export const SemanticTypeScanConfig = type({
  version: '1',
  source: 'string',
  topicNamespace: 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string',
  'declaredTopics?': 'string[]'
});

/**
 * Static type inferred from {@link SemanticTypeScanConfig}.
 */
export type SemanticTypeScanConfig = typeof SemanticTypeScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_SCAN_OUT_PATH = 'semantic-types.mcp.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Constant so tests
 * and the CLI agree on the discovery path.
 */
export const SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
