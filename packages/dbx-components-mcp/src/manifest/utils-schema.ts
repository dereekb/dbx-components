/**
 * Arktype schemas for the utils manifest format.
 *
 * Manifests are JSON files that catalog utilities (functions, classes,
 * constants, factory factories) opted in via the `@dbxUtil` JSDoc marker.
 * One manifest per source — bundled `@dereekb/*` packages plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json` — feeds
 * the merged registry that powers the `dbx_util_lookup` and
 * `dbx_util_search` MCP tools.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Closed vocabulary describing the kind of TypeScript export the utility
 * is. The extractor auto-detects from the source declaration (function vs.
 * class vs. const), and authors can override via `@dbxUtilKind`. `factory`
 * is reserved for functions whose return type is itself a function — used
 * by the configurable factory pattern.
 */
export const UTIL_KINDS = ['function', 'class', 'const', 'factory'] as const;

/**
 * Static type for the closed kind vocabulary.
 */
export type UtilKindValue = (typeof UTIL_KINDS)[number];

// MARK: Param entry
/**
 * One documented parameter of a function/factory utility, or one
 * constructor parameter for a class utility.
 */
export const UtilParamEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  optional: 'boolean'
});

/**
 * Static type inferred from {@link UtilParamEntry}.
 */
export type UtilParamEntry = typeof UtilParamEntry.infer;

// MARK: Entry
/**
 * One utility entry inside a manifest. Each entry describes a single
 * exported symbol — its slug, kind, category, signature, and the
 * documented parameters/return.
 *
 * Required fields are the minimum needed for `dbx_util_lookup` to render
 * a useful answer; every other field is optional so the auto-generator
 * can populate them progressively.
 */
export const UtilEntry = type({
  slug: 'string',
  name: 'string',
  kind: '"function" | "class" | "const" | "factory"',
  category: 'string',
  module: 'string',
  subpath: 'string',
  signature: 'string',
  description: 'string',
  params: UtilParamEntry.array(),
  returns: 'string',
  tags: 'string[]',
  'example?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link UtilEntry}.
 */
export type UtilEntry = typeof UtilEntry.infer;

// MARK: Manifest
/**
 * Top-level manifest envelope. One file per source. The `source` field is
 * the workspace-unique label used to detect collisions; `module` carries
 * the npm package the entries ship in.
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; manifests with any other value are rejected (strict
 * sources) or warned-and-skipped (non-strict sources).
 */
export const UtilManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: UtilEntry.array()
});

/**
 * Static type inferred from {@link UtilManifest}.
 */
export type UtilManifest = typeof UtilManifest.infer;
