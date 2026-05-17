/**
 * Arktype schemas for the model-firebase-index manifest format.
 *
 * Manifests catalog the Firestore query-constraint factories opted in via
 * the `@dbxModelFirebaseIndex` JSDoc marker — `*.query.ts` exports whose
 * `where`/`orderBy` constraint sequences imply a required composite index
 * or `fieldOverrides` entry in `firestore.indexes.json`. One manifest per
 * source — bundled `@dereekb/firebase` plus any downstream-app manifests
 * discovered via `dbx-mcp.config.json` — feeds the merged registry that
 * powers the `dbx_model_firebase_index_lookup`,
 * `dbx_model_firebase_index_search`, `dbx_model_firebase_index_list_app`,
 * and `dbx_model_firebase_index_validate_app` MCP tools, and the
 * `generate-firestore-indexes` CLI subcommand that emits a canonical
 * `firestore.indexes.json` from the merged registry.
 *
 * Mirrors {@link ModelSnapshotFieldManifest} — both are tag-driven scanners
 * over plain TS exports, so the schema shapes line up one-to-one. The
 * model-firebase-index schema adds the Firestore-specific payload:
 *   - `model` (the target TS type name)
 *   - `collection` (the resolved short collection name, e.g. `'jlw'`)
 *   - `isNested` (parent identity present, defaults scope to `COLLECTION_GROUP`)
 *   - `scope` (`COLLECTION` | `COLLECTION_GROUP`)
 *   - `manual` / `skip` flags from the JSDoc tags
 *   - `constraintSequences` (raw extracted ordered constraints, one per
 *     conditional-branch path)
 *   - `derivedComposites` (required composite indexes after analysis)
 *   - `derivedFieldOverrides` (required `fieldOverrides[]` contributions
 *     after analysis — single-field `COLLECTION_GROUP` queries)
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Firestore query scopes. `COLLECTION` runs against one collection by path;
 * `COLLECTION_GROUP` runs across every collection with the same id under any
 * parent. Auto single-field indexes are `COLLECTION` scope only — anything
 * `COLLECTION_GROUP` needs either a composite or a `fieldOverrides` entry.
 */
export const FIRESTORE_QUERY_SCOPES = ['COLLECTION', 'COLLECTION_GROUP'] as const;

/**
 * Static type for {@link FIRESTORE_QUERY_SCOPES}.
 */
export type FirestoreQueryScope = (typeof FIRESTORE_QUERY_SCOPES)[number];

/**
 * Ascending vs descending for `orderBy`-bound index fields.
 */
export const FIRESTORE_INDEX_ORDERS = ['ASCENDING', 'DESCENDING'] as const;

/**
 * Static type for {@link FIRESTORE_INDEX_ORDERS}.
 */
export type FirestoreIndexOrder = (typeof FIRESTORE_INDEX_ORDERS)[number];

/**
 * Array config for an index field — currently only `CONTAINS` (for
 * `array-contains` / `array-contains-any`). Vector configs are out of scope.
 */
export const FIRESTORE_INDEX_ARRAY_CONFIGS = ['CONTAINS'] as const;

/**
 * Static type for {@link FIRESTORE_INDEX_ARRAY_CONFIGS}.
 */
export type FirestoreIndexArrayConfig = (typeof FIRESTORE_INDEX_ARRAY_CONFIGS)[number];

/**
 * Index density. Firestore's default for composites is `SPARSE_ALL` — skip
 * documents missing any indexed field. Every composite in the live HelloSubs
 * deploy carries this; the generator emits it on every entry so generated
 * output round-trips cleanly against `firebase firestore:indexes`.
 */
export const FIRESTORE_INDEX_DENSITY_VALUES = ['SPARSE_ALL', 'SPARSE_ANY', 'DENSE'] as const;

/**
 * Static type for {@link FIRESTORE_INDEX_DENSITY_VALUES}.
 */
export type FirestoreIndexDensity = (typeof FIRESTORE_INDEX_DENSITY_VALUES)[number];

/**
 * Default density emitted by the generator. Matches the live HelloSubs deploy.
 */
export const DEFAULT_FIRESTORE_INDEX_DENSITY: FirestoreIndexDensity = 'SPARSE_ALL';

/**
 * Constraint kind inside a {@link ConstraintSequenceEntry}. `where` and
 * `orderBy` are the base SDK calls; `helper` records an expanded helper
 * (e.g. `whereDateIsBeforeWithSort`) so the source factory is faithful.
 */
export const FIRESTORE_CONSTRAINT_KINDS = ['where', 'orderBy'] as const;

/**
 * Static type for {@link FIRESTORE_CONSTRAINT_KINDS}.
 */
export type FirestoreConstraintKind = (typeof FIRESTORE_CONSTRAINT_KINDS)[number];

/**
 * Closed vocabulary of Firestore `where` operators the extractor knows
 * about. Drives the "is this equality / range / array-contains?" decision
 * the analyzer uses to apply Firestore composite-field-order rules.
 */
export const FIRESTORE_WHERE_OPERATORS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any'] as const;

/**
 * Static type for {@link FIRESTORE_WHERE_OPERATORS}.
 */
export type FirestoreWhereOperator = (typeof FIRESTORE_WHERE_OPERATORS)[number];

// MARK: Constraint sequence
/**
 * One constraint inside a {@link ConstraintSequence}. `kind` tells the
 * analyzer which field-order bucket the entry falls into; `operator` is
 * `where`-only; `direction` is `orderBy`-only; `fromHelper` records the
 * source helper when the entry was expanded from one of the
 * `firestoreQueryHelpers` registry entries (used for diagnostics).
 */
export const ConstraintSequenceEntry = type({
  kind: '"where" | "orderBy"',
  fieldPath: 'string',
  'operator?': '"==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "array-contains" | "array-contains-any"',
  'direction?': '"asc" | "desc"',
  'fromHelper?': 'string'
});

/**
 * Static type for {@link ConstraintSequenceEntry}.
 */
export type ConstraintSequenceEntry = typeof ConstraintSequenceEntry.infer;

/**
 * One linear path through a factory body. Conditional branches enumerate
 * into multiple sequences. The generator dedupes equivalent index outputs;
 * the sequence list itself is kept verbatim so diagnostics can point back
 * to the source branch.
 */
export const ConstraintSequence = type({
  'pathLabel?': 'string',
  entries: ConstraintSequenceEntry.array()
});

/**
 * Static type for {@link ConstraintSequence}.
 */
export type ConstraintSequence = typeof ConstraintSequence.infer;

// MARK: Derived index outputs
/**
 * One field inside a derived composite index. Exactly one of `order` /
 * `arrayConfig` is set.
 */
export const DerivedIndexField = type({
  fieldPath: 'string',
  'order?': '"ASCENDING" | "DESCENDING"',
  'arrayConfig?': '"CONTAINS"'
});

/**
 * Static type for {@link DerivedIndexField}.
 */
export type DerivedIndexField = typeof DerivedIndexField.infer;

/**
 * One composite index a factory requires. Field order matches Firestore's
 * required form (equality → range → array-contains → orderBy). The
 * `__name__` tiebreaker is NOT stored here — the generator appends it at
 * emission time, picking direction from the last orderBy.
 */
export const DerivedComposite = type({
  collectionGroup: 'string',
  queryScope: '"COLLECTION" | "COLLECTION_GROUP"',
  fields: DerivedIndexField.array(),
  density: '"SPARSE_ALL" | "SPARSE_ANY" | "DENSE"'
});

/**
 * Static type for {@link DerivedComposite}.
 */
export type DerivedComposite = typeof DerivedComposite.infer;

/**
 * One single-field `fieldOverrides[]` variant a factory contributes. Only
 * emitted for `COLLECTION_GROUP`-scope single-field queries (auto indexes
 * cover the `COLLECTION`-scope case). The generator combines multiple
 * factory contributions on the same `(collectionGroup, fieldPath)` plus
 * the standard `COLLECTION` quartet, mirroring the live HelloSubs deploy
 * shape.
 */
export const DerivedFieldOverrideVariant = type({
  queryScope: '"COLLECTION" | "COLLECTION_GROUP"',
  'order?': '"ASCENDING" | "DESCENDING"',
  'arrayConfig?': '"CONTAINS"'
});

/**
 * Static type for {@link DerivedFieldOverrideVariant}.
 */
export type DerivedFieldOverrideVariant = typeof DerivedFieldOverrideVariant.infer;

/**
 * One `fieldOverrides[]` contribution from a factory. `collectionGroup`
 * is the resolved short collection name, `fieldPath` is the field name
 * the factory queries by, and `variants[]` lists the (scope, order or
 * arrayConfig) tuples implied by the factory's constraint sequences.
 */
export const DerivedFieldOverride = type({
  collectionGroup: 'string',
  fieldPath: 'string',
  variants: DerivedFieldOverrideVariant.array()
});

/**
 * Static type for {@link DerivedFieldOverride}.
 */
export type DerivedFieldOverride = typeof DerivedFieldOverride.infer;

// MARK: Param entry
/**
 * One documented parameter of a query-factory function. Mirrors
 * {@link ModelSnapshotFieldParamEntry} so the same JSDoc-`@param`
 * extraction logic can be reused.
 */
export const ModelFirebaseIndexParamEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  optional: 'boolean'
});

/**
 * Static type for {@link ModelFirebaseIndexParamEntry}.
 */
export type ModelFirebaseIndexParamEntry = typeof ModelFirebaseIndexParamEntry.infer;

// MARK: Entry
/**
 * One model-firebase-index entry inside a manifest. Each entry describes a
 * single `@dbxModelFirebaseIndex`-tagged query factory — its slug, target
 * model, resolved collection name, scope, constraint sequences, and the
 * indexes/field-overrides it requires.
 *
 * Required fields are the minimum needed for
 * `dbx_model_firebase_index_lookup` to render a useful answer; every other
 * field is optional so the extractor can populate them progressively.
 */
export const ModelFirebaseIndexEntry = type({
  slug: 'string',
  name: 'string',
  module: 'string',
  subpath: 'string',
  signature: 'string',
  description: 'string',
  model: 'string',
  collection: 'string',
  isNested: 'boolean',
  scope: '"COLLECTION" | "COLLECTION_GROUP"',
  manual: 'boolean',
  skip: 'boolean',
  'specOnly?': 'boolean',
  'excluded?': 'boolean',
  category: 'string',
  params: ModelFirebaseIndexParamEntry.array(),
  returns: 'string',
  tags: 'string[]',
  constraintSequences: ConstraintSequence.array(),
  derivedComposites: DerivedComposite.array(),
  derivedFieldOverrides: DerivedFieldOverride.array(),
  'example?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type for {@link ModelFirebaseIndexEntry}.
 */
export type ModelFirebaseIndexEntry = typeof ModelFirebaseIndexEntry.infer;

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
export const ModelFirebaseIndexManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: ModelFirebaseIndexEntry.array()
});

/**
 * Static type for {@link ModelFirebaseIndexManifest}.
 */
export type ModelFirebaseIndexManifest = typeof ModelFirebaseIndexManifest.infer;
