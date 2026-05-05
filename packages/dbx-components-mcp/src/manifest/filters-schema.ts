/**
 * Arktype schemas for the filters manifest format.
 *
 * Manifests are JSON files that catalog the dbx-components filter surface —
 * the `[dbxFilter*]` directive family plus shape-only patterns such as
 * `ClickableFilterPreset`. One manifest per source — bundled `@dereekb/*`
 * packages plus any downstream-app manifests discovered via
 * `dbx-mcp.config.json` — feeds the merged registry that powers the
 * `dbx_filter_lookup` MCP tool.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Discriminator between Angular directives (`[dbxFilter*]`) and shape-only
 * patterns (`ClickableFilterPreset`). Mirrors the existing `FilterEntryKind`
 * exposed by the legacy hand-authored module.
 */
export const FILTER_KINDS = ['directive', 'pattern'] as const;

/**
 * Static type for the closed kind vocabulary.
 */
export type FilterKindValue = (typeof FILTER_KINDS)[number];

// MARK: Shared sub-shapes
/**
 * One documented input on a filter directive — alias, type, description.
 * Filter directives are read-mostly: most have zero inputs, a few accept a
 * single map key; required flags are not tracked because every input is
 * optional in the rendered docs.
 */
export const FilterInputEntry = type({
  name: 'string',
  type: 'string',
  description: 'string'
});

/**
 * Static type inferred from {@link FilterInputEntry}.
 */
export type FilterInputEntry = typeof FilterInputEntry.infer;

// MARK: Entry — directive
/**
 * Directive entry. Captures the `@Directive({selector})` plus any inputs and
 * outputs declared on the class. Required fields are the minimum needed for
 * `dbx_filter_lookup` to render a useful answer.
 */
export const FilterDirectiveEntry = type({
  kind: '"directive"',
  slug: 'string',
  selector: 'string',
  className: 'string',
  module: 'string',
  description: 'string',
  inputs: FilterInputEntry.array(),
  outputs: FilterInputEntry.array(),
  example: 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link FilterDirectiveEntry}.
 */
export type FilterDirectiveEntry = typeof FilterDirectiveEntry.infer;

// MARK: Entry — pattern
/**
 * Pattern entry. Shape-only entries (interfaces, type aliases) without an
 * Angular `@Directive` decorator. The `selector` field is omitted — pattern
 * entries are referenced in TypeScript code, not the template DOM.
 */
export const FilterPatternEntry = type({
  kind: '"pattern"',
  slug: 'string',
  className: 'string',
  module: 'string',
  description: 'string',
  example: 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link FilterPatternEntry}.
 */
export type FilterPatternEntry = typeof FilterPatternEntry.infer;

// MARK: Entry — union
/**
 * Discriminated union of every filter entry shape. Matches the legacy
 * `FilterEntryInfo` shape's `kind: 'directive' | 'pattern'` discriminator
 * so the runtime registry can preserve consumer-visible field names.
 */
export const FilterEntry = FilterDirectiveEntry.or(FilterPatternEntry);

/**
 * Static type inferred from {@link FilterEntry}.
 */
export type FilterEntry = typeof FilterEntry.infer;

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
export const FilterManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: FilterEntry.array()
});

/**
 * Static type inferred from {@link FilterManifest}.
 */
export type FilterManifest = typeof FilterManifest.infer;
