/**
 * Arktype schemas for the pipes manifest format.
 *
 * Manifests are JSON files that catalog Angular pipe classes — value pipes
 * (`dollarAmount`, `cutText`, `getValue` / `getValueOnce`), the async helper
 * (`asObservable`), `prettyjson`, and the date pipe family. One manifest per
 * source — bundled `@dereekb/*` packages plus any downstream-app manifests
 * discovered via `dbx-mcp.config.json` — feeds the merged registry that
 * powers the `dbx_pipe_lookup` MCP tool.
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates. Optional fields can be added in v1; structural breaks must
 * bump the manifest `version` and update the loader's accepted versions.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Browse-friendly category grouping. Mirrors the on-disk folder layout of
 * `packages/dbx-core/src/lib/pipe/` (`value/`, `date/`, `async/`, `misc/`).
 */
export const PIPE_CATEGORIES = ['value', 'date', 'async', 'misc'] as const;

/**
 * Static type for the closed category vocabulary.
 */
export type PipeCategoryValue = (typeof PIPE_CATEGORIES)[number];

/**
 * Whether the pipe is `pure: true` (default — runs only when the reference
 * to its inputs change) or `pure: false` (runs on every change detection).
 */
export const PIPE_PURITIES = ['pure', 'impure'] as const;

/**
 * Static type for the closed purity vocabulary.
 */
export type PipePurityValue = (typeof PIPE_PURITIES)[number];

// MARK: Argument
/**
 * One documented argument supplied to the pipe `transform()` method on top
 * of the piped value (e.g. `{{ value | dollarAmount:'N/A' }}` — `'N/A'` is
 * the `defaultIfNull` argument).
 */
export const PipeArgEntry = type({
  name: 'string',
  type: 'string',
  description: 'string',
  required: 'boolean'
});

/**
 * Static type inferred from {@link PipeArgEntry}.
 */
export type PipeArgEntry = typeof PipeArgEntry.infer;

// MARK: Entry
/**
 * One pipe entry inside a manifest. Each entry describes a single exported
 * pipe class — its slug, category, Angular pipe name, transform signature,
 * and the documented arguments.
 *
 * Required fields are the minimum needed for `dbx_pipe_lookup` to render a
 * useful answer; every other field is optional so the auto-generator can
 * populate them progressively.
 */
export const PipeEntry = type({
  slug: 'string',
  category: '"value" | "date" | "async" | "misc"',
  pipeName: 'string',
  className: 'string',
  module: 'string',
  inputType: 'string',
  outputType: 'string',
  purity: '"pure" | "impure"',
  description: 'string',
  args: PipeArgEntry.array(),
  example: 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link PipeEntry}.
 */
export type PipeEntry = typeof PipeEntry.infer;

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
export const PipeManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: PipeEntry.array()
});

/**
 * Static type inferred from {@link PipeManifest}.
 */
export type PipeManifest = typeof PipeManifest.infer;
