/**
 * Arktype schemas for the ui-components manifest format.
 *
 * Manifests are JSON files that catalog UI components, directives, pipes, and
 * services from one source — either a `@dereekb/*` package bundled with this
 * MCP, or a downstream-app manifest discovered via `dbx-mcp.config.json`.
 * Each manifest contributes its entries to a merged registry that the
 * `lookup-ui` and `search-ui` MCP tools query.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * High-level category bucket for a UI entry — the primary search index.
 */
export const UI_COMPONENT_CATEGORIES = ['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc'] as const;

/**
 * Static type for the closed category vocabulary.
 */
export type UiComponentCategoryValue = (typeof UI_COMPONENT_CATEGORIES)[number];

/**
 * Angular construct kind. Drives output formatting in tools (components have
 * content projection, directives advertise selectors, pipes have transform
 * signatures, services expose injection tokens).
 */
export const UI_COMPONENT_KINDS = ['component', 'directive', 'pipe', 'service'] as const;

/**
 * Static type for the closed kind vocabulary.
 */
export type UiComponentKindValue = (typeof UI_COMPONENT_KINDS)[number];

// MARK: Inputs / Outputs
/**
 * One input (signal `input()` or `@Input()`-decorated property) on a UI entry.
 */
export const UiComponentInputEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  required: 'boolean',
  'default?': 'string'
});

/**
 * Static type inferred from {@link UiComponentInputEntry}.
 */
export type UiComponentInputEntry = typeof UiComponentInputEntry.infer;

/**
 * One output (signal `output()` or `@Output()` `EventEmitter`) on a UI entry.
 */
export const UiComponentOutputEntry = type({
  name: 'string',
  emits: 'string',
  description: 'string'
});

/**
 * Static type inferred from {@link UiComponentOutputEntry}.
 */
export type UiComponentOutputEntry = typeof UiComponentOutputEntry.infer;

// MARK: Entry
/**
 * One UI entry inside a manifest. Each entry describes a single exported
 * Angular construct — its selector, where it lives, what category it indexes
 * under, and the inputs/outputs callers wire to.
 *
 * Required fields are the minimum needed for `lookup-ui` to render a useful
 * answer. Every other field is optional so the auto-generator can populate
 * them progressively.
 */
export const UiComponentEntry = type({
  slug: 'string',
  category: '"layout" | "list" | "button" | "card" | "feedback" | "overlay" | "navigation" | "text" | "screen" | "action" | "router" | "misc"',
  kind: '"component" | "directive" | "pipe" | "service"',
  selector: 'string',
  className: 'string',
  module: 'string',
  description: 'string',
  inputs: UiComponentInputEntry.array(),
  outputs: UiComponentOutputEntry.array(),
  'contentProjection?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'example?': 'string',
  'minimalExample?': 'string',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link UiComponentEntry}. Co-named with the const
 * so callers can write `import { UiComponentEntry }` and use it in both value
 * and type positions.
 */
export type UiComponentEntry = typeof UiComponentEntry.infer;

// MARK: Manifest
/**
 * Top-level manifest envelope. One file per source. The `source` field is the
 * workspace-unique label used to detect collisions; `module` carries the npm
 * package the entries ship in.
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; manifests with any other value are rejected (strict
 * sources) or warned-and-skipped (non-strict sources).
 */
export const UiComponentManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: UiComponentEntry.array()
});

/**
 * Static type inferred from {@link UiComponentManifest}.
 */
export type UiComponentManifest = typeof UiComponentManifest.infer;
