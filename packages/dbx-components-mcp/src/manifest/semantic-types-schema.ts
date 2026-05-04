/**
 * Arktype schemas for the semantic-types manifest format.
 *
 * Manifests are JSON files that catalog semantic types (`EmailAddress`,
 * `Milliseconds`, `LatLngPoint`, …) from one source — either a `@dereekb/*`
 * package bundled with this MCP, or a downstream-app manifest discovered via
 * `dbx-mcp.config.json`. Each manifest contributes its entries to a merged,
 * cross-package index that the (future) `lookup-semantic-type` and
 * `search-semantic-type` MCP tools query.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Entry
/**
 * One semantic-type entry inside a manifest. Each entry describes a single
 * exported TypeScript type — its definition, where it lives, what topics it
 * indexes under, and the companion functions (guards, factories, converters)
 * that travel with it.
 *
 * Required fields are the minimum needed for lookup to render a useful
 * answer. Every other field is optional so the auto-generator can populate
 * them progressively (e.g. fill `examples` from JSDoc `@example` blocks when
 * present and skip them otherwise).
 */
export const SemanticTypeEntry = type({
  name: 'string',
  package: 'string',
  module: 'string',
  kind: '"semantic-type" | "type-alias"',
  definition: 'string',
  baseType: '"string" | "number" | "boolean" | "object" | "branded" | "union-literal" | "template-literal" | "other"',
  topics: 'string[] >= 1',
  'unionValues?': 'string[]',
  'typeParameters?': 'string[]',
  'aliases?': 'string[]',
  'related?': 'string[]',
  'reExportedFrom?': type({ package: 'string', module: 'string' }).array(),
  'guards?': 'string[]',
  'factories?': 'string[]',
  'converters?': 'string[]',
  'examples?': type({ 'caption?': 'string', code: 'string' }).array(),
  'notes?': 'string',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link SemanticTypeEntry}. Co-named with the const
 * so callers can write `import { SemanticTypeEntry }` and use it in both
 * value and type positions.
 */
export type SemanticTypeEntry = typeof SemanticTypeEntry.infer;

// MARK: Manifest
/**
 * Top-level manifest envelope. One file per source. The `source` field is
 * the workspace-unique label used to detect collisions and to scope
 * namespaced topics; `topicNamespace` is the prefix attached to those
 * topics (e.g. `dereekb-util:duration`).
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; manifests with any other value are rejected (strict
 * sources) or warned-and-skipped (non-strict sources).
 */
export const SemanticTypeManifest = type({
  version: '1',
  source: 'string',
  topicNamespace: 'string',
  generatedAt: 'string',
  generator: 'string',
  topics: 'string[]',
  entries: SemanticTypeEntry.array()
});

/**
 * Static type inferred from {@link SemanticTypeManifest}.
 */
export type SemanticTypeManifest = typeof SemanticTypeManifest.infer;
