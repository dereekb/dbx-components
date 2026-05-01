/**
 * Arktype schema for `dbx-mcp.config.json`.
 *
 * The config file lives at the workspace root and carries three kinds of
 * settings:
 *
 * 1. `<cluster>.sources` — repo-relative paths to *external* generated
 *    manifests merged alongside the bundled `@dereekb/*` registries.
 * 2. `<cluster>.scan` — per-package scan inputs that drive bundled-manifest
 *    generation (replacing the per-package `dbx-mcp.scan.json` files this
 *    repo previously shipped).
 * 3. `modelValidate` — overrides for the firebase-model rule pipeline
 *    (field-name length limit, ignored field names).
 *
 * The bundled registries are *always* loaded; `sources` adds extras. The
 * `scan` array is consumed by `scripts/generate-manifests.mjs` at build
 * time. `modelValidate` is read once at server bootstrap and threaded into
 * `dbx_model_validate`'s rule options.
 */

import { type } from 'arktype';

/**
 * One entry in `<cluster>.scan[]`. Mirrors the shape of the legacy
 * per-package `dbx-mcp.scan.json` plus a `project` field that names the
 * package directory the scan should target. Fields are intentionally a
 * permissive superset across all six clusters — semantic-types entries
 * carry `topicNamespace` / `declaredTopics`, cluster-with-section entries
 * carry `module`, and per-cluster CLIs read only the fields they care
 * about.
 */
const ScanEntry = type({
  /**
   * Repo-relative project root (e.g. `packages/util`). The build
   * orchestrator passes this to the cluster CLI as `--project <project>`.
   */
  project: 'string',
  /**
   * Source label baked into the produced manifest. Typically the npm
   * package name (`@dereekb/util`).
   */
  source: 'string',
  /**
   * Source-file globs (project-relative) the scanner should walk.
   */
  'include?': 'string[]',
  /**
   * Source-file globs to exclude from the scan.
   */
  'exclude?': 'string[]',
  /**
   * Repo-relative output path for the generated manifest. Resolved as
   * `<workspaceRoot>/<out>` by the orchestrator; the legacy
   * project-relative `../dbx-components-mcp/generated/...` form continues
   * to work because callers typically pass it through unchanged.
   */
  out: 'string',
  /**
   * Semantic-types only — namespace prefix applied to topic names.
   */
  'topicNamespace?': 'string',
  /**
   * Semantic-types only — pre-declared topic list propagated into the
   * manifest envelope.
   */
  'declaredTopics?': 'string[]',
  /**
   * Cluster-with-section only — npm module name attached to every
   * produced entry (defaults to `package.json#name` when omitted).
   */
  'module?': 'string'
});

/**
 * Per-cluster section. Holds two siblings — `sources` (external manifests
 * to merge at runtime) and `scan` (per-package scan inputs consumed at
 * build time). Both are optional; a fresh install with neither set falls
 * back to the bundled `@dereekb/*` manifests only.
 */
const ClusterSection = type({
  'sources?': 'string[]',
  'scan?': ScanEntry.array()
});

/**
 * Top-level config schema. Missing-but-optional cluster keys mean the
 * MCP runs with only its bundled `@dereekb/*` manifests, which is the
 * intended default for fresh installs.
 */
export const DbxMcpConfig = type({
  version: '1',
  'modelValidate?': {
    'maxFieldNameLength?': 'number>=1',
    'ignoredFieldNames?': 'string[]'
  },
  'semanticTypes?': ClusterSection,
  'uiComponents?': ClusterSection,
  'forgeFields?': ClusterSection,
  'pipes?': ClusterSection,
  'actions?': ClusterSection,
  'filters?': ClusterSection
});

/**
 * Static type inferred from {@link DbxMcpConfig}.
 */
export type DbxMcpConfig = typeof DbxMcpConfig.infer;

/**
 * Static type inferred from `ScanEntry`. Exported so the build
 * orchestrator and per-cluster CLIs can share one canonical entry type.
 */
export type DbxMcpScanEntry = typeof ScanEntry.infer;
