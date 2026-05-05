/**
 * Arktype schemas for the CSS-utility-class manifest format.
 *
 * Manifests catalog the curated, opt-in utility classes shipped by
 * `@dereekb/dbx-web` (and any downstream apps that opt into the same
 * `cssUtilities.scan[]` pipeline). Each entry maps a single class selector
 * (`.dbx-flex-fill-0`, `.dbx-text-truncate`, …) to its source file/line, the
 * flat property/value declarations the rule emits, and curator-supplied
 * metadata (intent, role, see-also, anti-use, optional parent slug, optional
 * compound-selector context chain).
 *
 * Curation is opt-in: only selectors annotated with `/// @dbx-utility` in the
 * source SCSS make it into the registry. Extension-feature classes are
 * excluded by design so the catalog stays focused on reusable primitives.
 *
 * The optional `parent` slug groups helper utilities under a parent class
 * (e.g. `dbx-list-two-line-item-icon` carries `parent: "dbx-list-two-line-item"`).
 * The runtime registry exposes a `byParent` index and `findChildrenOf(slug)`
 * accessor; the lookup tool hides children from bulk browse/search results
 * by default to keep output focused on top-level primitives.
 *
 * The optional `selectorContext` field captures the full descendant-chain
 * selector when a utility is defined as a compound rule (e.g.
 * `.dbx-list-no-item-padding .dbx-list > .dbx-list-content …`). The first
 * flat class in the chain becomes the canonical `selector` (the host class
 * consumers add to their HTML), and the original compound text is preserved
 * as `selectorContext` so the usage context — "apply this class within a
 * `.dbx-list` context" — is not lost. Flat top-level utilities omit this
 * field.
 *
 * The optional `component` and `scope` fields mark an entry as a
 * component-owned class (e.g. `.dbx-icon-tile` belongs to
 * `DbxIconTileComponent`). Setting `scope: "component-class"` tells the
 * lookup tool to render a "use the component, not the class" hint while
 * still surfacing the rule's CSS variables — useful for understanding
 * how to customize the component via tokens without misapplying the
 * class to arbitrary markup.
 *
 * The optional `tokensRead` / `tokensSet` arrays capture the CSS custom
 * properties this rule reads (via `var(--name, …)`) and sets (via
 * `--name: value` declarations). Both arrays are derived deterministically
 * from the rule's body during extraction. They give consumers a direct
 * "what can I override?" / "what does this override on descendants?" view
 * without re-parsing the source SCSS.
 *
 * The merged registry feeds `dbx_css_class_lookup` — forward (intent →
 * class), reverse (declarations → class), exact-name, and parent-scoped
 * modes share one shape.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * High-level role for a CSS utility class — drives both filtering and the
 * heuristic score weighting inside the equivalency search engine. Roles are
 * intentionally coarse so the curation gate stays low-friction.
 */
export const CSS_UTILITY_ROLES = ['layout', 'flex', 'text', 'spacing', 'state', 'interaction', 'misc'] as const;

/**
 * Static type for the closed CSS-utility-role vocabulary.
 */
export type CssUtilityRoleValue = (typeof CSS_UTILITY_ROLES)[number];

/**
 * Closed vocabulary for the optional `scope` field on a utility entry.
 *
 * - `utility` (default when omitted) — a reusable utility class consumers
 *   can apply to any element.
 * - `component-class` — a class that ships as part of an Angular component
 *   template. The class is cataloged so its tokens and intent are
 *   discoverable, but it should NOT be added to arbitrary elements; use the
 *   owning component instead. Pair with `@component <ClassName>` so the
 *   lookup tool can name the owner.
 */
export const CSS_UTILITY_SCOPES = ['utility', 'component-class'] as const;

/**
 * Static type for the closed CSS-utility-scope vocabulary.
 */
export type CssUtilityScopeValue = (typeof CSS_UTILITY_SCOPES)[number];

// MARK: Declaration
/**
 * One flat CSS declaration captured from the source rule. Properties are
 * lowercased; values are preserved verbatim so downstream consumers can
 * surface the exact text (handy when the value is a CSS function, var
 * reference, or expression).
 */
export const CssUtilityDeclaration = type({
  property: 'string',
  value: 'string'
});

/**
 * Static type inferred from {@link CssUtilityDeclaration}.
 */
export type CssUtilityDeclaration = typeof CssUtilityDeclaration.infer;

// MARK: Entry
/**
 * One CSS-utility-class entry in a manifest. Captures the slug (curator
 * choice; defaults to selector minus leading `.`), the canonical selector,
 * file/line provenance, the flat declarations the rule emits, and any
 * curator-supplied metadata (role, intent, see-also list, anti-use note,
 * `@since` version tag, optional `@parent` slug grouping helper utilities
 * under their parent class).
 */
export const CssUtilityEntry = type({
  slug: 'string',
  selector: 'string',
  source: 'string',
  module: 'string',
  file: 'string',
  line: 'number',
  declarations: CssUtilityDeclaration.array(),
  'role?': '"layout" | "flex" | "text" | "spacing" | "state" | "interaction" | "misc"',
  'intent?': 'string',
  'seeAlso?': 'string[]',
  'antiUse?': 'string',
  'since?': 'string',
  'parent?': 'string',
  // The full descendant-chain selector when the rule is defined as a compound
  // selector. Stored verbatim so consumers can see the usage context (e.g.
  // `.dbx-list-no-item-padding .dbx-list > .dbx-list-content …` says "apply
  // this class within a `.dbx-list` context"). Absent for flat top-level
  // utilities where `selector` already conveys the full rule head.
  'selectorContext?': 'string',
  // Owning Angular component class name when the rule is part of a
  // component's template (e.g. `.dbx-icon-tile` is owned by
  // `DbxIconTileComponent`). Surfaces in the lookup output so consumers
  // know which component to use instead of applying the class by hand.
  'component?': 'string',
  // `utility` (default) → reusable; safe to apply anywhere.
  // `component-class` → ships with the named component; apply via the
  // component, not by hand. Cataloged so tokens are discoverable.
  'scope?': '"utility" | "component-class"',
  // Sorted, deduped list of CSS custom properties (`--name`) read inside
  // any `var(--name, …)` reference within this rule's declarations. These
  // are the tokens consumers can override to customize the rule's effect.
  'tokensRead?': 'string[]',
  // Sorted, deduped list of CSS custom properties (`--name`) declared by
  // this rule. These cascade to descendants — handy for spotting which
  // tokens a wrapper class overrides on the elements inside it.
  'tokensSet?': 'string[]'
});

/**
 * Static type inferred from {@link CssUtilityEntry}.
 */
export type CssUtilityEntry = typeof CssUtilityEntry.infer;

// MARK: Manifest
/**
 * Top-level CSS-utility-class manifest envelope. One file per source label
 * (`@dereekb/dbx-web`, `<app-name>`). The loader merges these into a single
 * registry, detecting source-label collisions and entry-key collisions per
 * the existing `loadManifestsBase` pattern.
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; any other value is rejected (strict) or warn-and-skip
 * (non-strict) per `loadManifestsBase`.
 */
export const CssUtilityManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: CssUtilityEntry.array()
});

/**
 * Static type inferred from {@link CssUtilityManifest}.
 */
export type CssUtilityManifest = typeof CssUtilityManifest.infer;
