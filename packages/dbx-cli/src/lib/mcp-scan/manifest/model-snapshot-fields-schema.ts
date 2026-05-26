/**
 * Arktype schemas for the model-snapshot-fields manifest format.
 *
 * Manifests catalog the snapshot field factories and reusable field
 * constants opted in via the `@dbxModelSnapshotField` JSDoc marker — the
 * building blocks composed inside `snapshotConverterFunctions<T>({
 * fields: { ... } })` to convert Firestore documents to/from app models.
 * One manifest per source — bundled `@dereekb/firebase` plus any
 * downstream-app manifests discovered via `dbx-mcp.config.json` — feeds
 * the merged registry that powers the `dbx_model_snapshot_field_lookup`,
 * `dbx_model_snapshot_field_search`, and `dbx_model_snapshot_field_list_app`
 * MCP tools.
 *
 * Mirrors {@link UtilManifest} (`utils-schema.ts`) — both are produced by
 * tag-driven scanners over plain TS exports, so the schema shapes line up
 * one-to-one. The model-snapshot-field schema adds an `optional` flag for
 * the `optionalFirestore*` variants.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Closed vocabulary describing the kind of TypeScript export a snapshot
 * field is. Only `factory` (a function returning a converter config) and
 * `const` (a pre-built converter constant like `firestoreModelKeyString`)
 * are supported — classes and free functions don't fit the snapshot-field
 * shape.
 */
export const MODEL_SNAPSHOT_FIELD_KINDS = ['factory', 'const'] as const;

/**
 * Static type for the closed kind vocabulary.
 */
export type ModelSnapshotFieldKindValue = (typeof MODEL_SNAPSHOT_FIELD_KINDS)[number];

// MARK: Param entry
/**
 * One documented parameter of a factory snapshot field. Mirrors
 * {@link UtilParamEntry} so the same JSDoc-`@param` extraction logic can
 * be reused.
 */
export const ModelSnapshotFieldParamEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  optional: 'boolean'
});

/**
 * Static type inferred from {@link ModelSnapshotFieldParamEntry}.
 */
export type ModelSnapshotFieldParamEntry = typeof ModelSnapshotFieldParamEntry.infer;

// MARK: Entry
/**
 * One snapshot-field entry inside a manifest. Each entry describes a
 * single exported symbol used inside a `snapshotConverterFunctions` field
 * map — its slug, kind, category, signature, optional/required flag, and
 * the documented parameters/return.
 *
 * Required fields are the minimum needed for `dbx_model_snapshot_field_lookup`
 * to render a useful answer; every other field is optional so the auto-
 * generator can populate them progressively.
 */
export const ModelSnapshotFieldEntry = type({
  slug: 'string',
  name: 'string',
  kind: '"factory" | "const"',
  category: 'string',
  module: 'string',
  subpath: 'string',
  signature: 'string',
  description: 'string',
  optional: 'boolean',
  params: ModelSnapshotFieldParamEntry.array(),
  returns: 'string',
  tags: 'string[]',
  'example?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link ModelSnapshotFieldEntry}.
 */
export type ModelSnapshotFieldEntry = typeof ModelSnapshotFieldEntry.infer;

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
export const ModelSnapshotFieldManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: ModelSnapshotFieldEntry.array()
});

/**
 * Static type inferred from {@link ModelSnapshotFieldManifest}.
 */
export type ModelSnapshotFieldManifest = typeof ModelSnapshotFieldManifest.infer;
