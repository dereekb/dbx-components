/**
 * Arktype schemas for the forge-fields manifest format.
 *
 * Manifests are JSON files that catalog @dereekb/dbx-form factory exports —
 * field factories (`dbxForgeTextField`), composite builders (`dbxForgeDateRangeRow`),
 * and layout primitives (`dbxForgeRow`). One manifest per source — bundled
 * `@dereekb/*` packages plus any downstream-app manifests discovered via
 * `dbx-mcp.config.json` — feeds the merged registry that powers the
 * `lookup-form` and `search-form` MCP tools.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Five-tier classification of forge factories — see the
 * `dbx__ref__dbx-forge-field` skill for the canonical definitions.
 *
 *   - `field-factory`     dbxForgeFieldFunction / dbxForgeMaterialFormFieldWrappedFieldFunction — registers a type
 *   - `field-derivative`  pre-configured wrapper around a single field-factory; returns one field of the same shape with presets baked in (does NOT register a type)
 *   - `composite-builder` plain function composing other forge entries into ONE field/group — does NOT register a type
 *   - `template-builder`  returns multiple related fields as an array/tuple — distinct from composite-builders, which compose into a single container
 *   - `primitive`         core layout helper (row, group, array, section)
 */
export const FORGE_FIELD_TIERS = ['field-factory', 'field-derivative', 'composite-builder', 'template-builder', 'primitive'] as const;

/**
 * Static type for the closed tier vocabulary.
 */
export type ForgeFieldTierValue = (typeof FORGE_FIELD_TIERS)[number];

/**
 * Factory-only flag describing how a field-factory entry is built.
 *
 *   - `unwrapped`                    `dbxForgeFieldFunction` — the field renders its own chrome
 *   - `material-form-field-wrapped`  `dbxForgeMaterialFormFieldWrappedFieldFunction` — wrapped in mat-form-field
 */
export const FORGE_FIELD_WRAPPER_PATTERNS = ['unwrapped', 'material-form-field-wrapped'] as const;

/**
 * Static type for the closed wrapper-pattern vocabulary.
 */
export type ForgeFieldWrapperPatternValue = (typeof FORGE_FIELD_WRAPPER_PATTERNS)[number];

/**
 * Composite-builder-only suffix advertising the return shape of the builder.
 *
 *   - `Row`     `dbxForgeXRow`     → `RowField`
 *   - `Group`   `dbxForgeXGroup`   → `GroupField`
 *   - `Fields`  `dbxForgeXFields`  → `FieldDef[]`
 *   - `Field`   `dbxForgeXField`   → single field (composite array fields keep `Field`)
 *   - `Wrapper` `dbxForgeXWrapper` → WrapperConfig or composed layout
 *   - `Layout`  `dbxForgeXLayout`  → GroupField with responsive flex configuration
 */
export const FORGE_FIELD_COMPOSITE_SUFFIXES = ['Row', 'Group', 'Fields', 'Field', 'Wrapper', 'Layout'] as const;

/**
 * Static type for the closed composite-suffix vocabulary.
 */
export type ForgeFieldCompositeSuffixValue = (typeof FORGE_FIELD_COMPOSITE_SUFFIXES)[number];

/**
 * Whether an entry's output is an array, single value, or configurable.
 *
 *   - `yes`       entry always produces a collection (form value is an array, OR
 *                 composite returns `FieldDef[]`).
 *   - `no`        entry produces a single value / single field.
 *   - `optional`  entry can be configured either way (e.g. searchable-chip).
 */
export const FORGE_FIELD_ARRAY_OUTPUTS = ['yes', 'no', 'optional'] as const;

/**
 * Static type for the closed array-output vocabulary.
 */
export type ForgeFieldArrayOutputValue = (typeof FORGE_FIELD_ARRAY_OUTPUTS)[number];

// MARK: Property
/**
 * One property auto-extracted from the entry's config interface. Mirrors the
 * shape of {@link PropertyInfo} from the registry barrel — captured here for
 * the manifest contract, with `default` stored as a string so JSON
 * serialization is lossless.
 */
export const ForgeFieldPropertyEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  required: 'boolean',
  'default?': 'string'
});

/**
 * Static type inferred from {@link ForgeFieldPropertyEntry}.
 */
export type ForgeFieldPropertyEntry = typeof ForgeFieldPropertyEntry.infer;

// MARK: Entry
/**
 * One forge-field entry inside a manifest. Each entry describes a single
 * exported factory — its slug, tier classification, output type, and the
 * config properties callers wire to.
 *
 * Tier-specific fields are optional at the schema level; the runtime
 * registry asserts the right combination per tier. Required fields are the
 * minimum needed for `lookup-form` to render a useful answer; every other
 * field is optional so the auto-generator can populate them progressively.
 */
export const ForgeFieldEntry = type({
  slug: 'string',
  factoryName: 'string',
  tier: '"field-factory" | "field-derivative" | "composite-builder" | "template-builder" | "primitive"',
  produces: 'string',
  arrayOutput: '"yes" | "no" | "optional"',
  description: 'string',
  sourcePath: 'string',
  example: 'string',
  properties: ForgeFieldPropertyEntry.array(),
  // field-factory-only
  'wrapperPattern?': '"unwrapped" | "material-form-field-wrapped"',
  'ngFormType?': 'string',
  // field-factory + field-derivative
  'generic?': 'string',
  // composite-builder-only
  'suffix?': '"Row" | "Group" | "Fields" | "Field" | "Wrapper" | "Layout"',
  // composite-builder + field-derivative + template-builder
  'composesFromSlugs?': 'string[]',
  // primitive-only
  'returns?': 'string',
  // field-factory + field-derivative + composite-builder + template-builder required, primitive optional
  'configInterface?': 'string',
  // common optional
  'sourceLocation?': type({ file: 'string', line: 'number' }),
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link ForgeFieldEntry}.
 */
export type ForgeFieldEntry = typeof ForgeFieldEntry.infer;

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
export const ForgeFieldManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: ForgeFieldEntry.array()
});

/**
 * Static type inferred from {@link ForgeFieldManifest}.
 */
export type ForgeFieldManifest = typeof ForgeFieldManifest.infer;
