/**
 * Arktype schemas for the design-token manifest format.
 *
 * Manifests catalog CSS custom properties (and their SCSS-side wrappers)
 * exposed by `@dereekb/dbx-web`, Angular Material's `--mat-sys-*` system, the
 * underlying `--mdc-*` component tokens, and any downstream-app tokens
 * declared via `dbx-mcp.config.json`. Each entry advertises the canonical
 * `var(--…)` reference, intent/role metadata, light/dark defaults, and (when
 * relevant) the `@dereekb/dbx-web` UI primitive that already wraps the
 * underlying CSS value.
 *
 * The merged registry feeds both `dbx_css_token_lookup` (forward — intent →
 * token) and `dbx_ui_smell_check` (reverse — paste raw values → flag the
 * canonical replacement).
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * High-level role for a token — drives both filtering and the heuristic
 * fallback applied when the SCSS extractor finds no `///` sassdoc block.
 */
export const TOKEN_ROLES = ['color', 'text-color', 'surface', 'spacing', 'radius', 'elevation', 'shadow', 'typography', 'motion', 'state-layer', 'size', 'breakpoint', 'misc'] as const;

/**
 * Static type for the closed token-role vocabulary.
 */
export type TokenRoleValue = (typeof TOKEN_ROLES)[number];

/**
 * Origin of a token — used for filtering (`category=mat-sys`) and to indicate
 * authoritative source. `dbx-web` aliases live alongside `mat-sys` system
 * values; downstream apps surface as `app`.
 */
export const TOKEN_SOURCES = ['dbx-web', 'mat-sys', 'mdc', 'app'] as const;

/**
 * Static type for the closed token-source vocabulary.
 */
export type TokenSourceValue = (typeof TOKEN_SOURCES)[number];

// MARK: Defaults
/**
 * Default values resolved from the source SCSS / theme partials. `light`
 * and `dark` are both optional — a token might only have one mode, or the
 * value might be a CSS function reference (`var(--mat-sys-…)`) that gets
 * captured verbatim.
 */
export const TokenDefaults = type({
  'light?': 'string',
  'dark?': 'string'
});

/**
 * Static type inferred from {@link TokenDefaults}.
 */
export type TokenDefaults = typeof TokenDefaults.infer;

// MARK: Source location
/**
 * Optional source-file location an entry was extracted from. Surfaced in
 * deep-detail tool output so callers can jump to the underlying SCSS.
 */
export const TokenSourceLocation = type({
  file: 'string',
  line: 'number'
});

/**
 * Static type inferred from {@link TokenSourceLocation}.
 */
export type TokenSourceLocation = typeof TokenSourceLocation.infer;

// MARK: Entry
/**
 * One token entry in a manifest. Captures everything `dbx_css_token_lookup` and
 * `dbx_ui_smell_check` need to render an answer — the CSS variable, optional
 * SCSS-side wrapper, role bucket, intent strings (used for fuzzy intent
 * matching), light/dark defaults (used for value-distance scoring), utility
 * classes, and a recommended dbx-web primitive when one wraps the underlying
 * value.
 */
export const TokenEntry = type({
  cssVariable: 'string',
  'scssVariable?': 'string',
  source: '"dbx-web" | "mat-sys" | "mdc" | "app"',
  role: '"color" | "text-color" | "surface" | "spacing" | "radius" | "elevation" | "shadow" | "typography" | "motion" | "state-layer" | "size" | "breakpoint" | "misc"',
  intents: 'string[]',
  description: 'string',
  'antiUseNotes?': 'string',
  defaults: TokenDefaults,
  'utilityClasses?': 'string[]',
  'componentScope?': 'string',
  'recommendedPrimitive?': 'string',
  'seeAlso?': 'string[]',
  'sourceLocation?': TokenSourceLocation
});

/**
 * Static type inferred from {@link TokenEntry}.
 */
export type TokenEntry = typeof TokenEntry.infer;

// MARK: Manifest
/**
 * Top-level token manifest envelope. One file per source label
 * (`dereekb-dbx-web`, `angular-material-m3`, `angular-material-mdc`,
 * `<app-name>`). The loader merges these into a single registry,
 * detecting source-label collisions and entry-key collisions per the
 * existing `loadManifestsBase` pattern.
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; any other value is rejected (strict) or warn-and-skip
 * (non-strict) per `loadManifestsBase`.
 */
export const TokenManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: TokenEntry.array()
});

/**
 * Static type inferred from {@link TokenManifest}.
 */
export type TokenManifest = typeof TokenManifest.infer;
