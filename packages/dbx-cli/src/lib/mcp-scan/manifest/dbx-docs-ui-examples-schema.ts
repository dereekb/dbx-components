/**
 * Arktype schemas for the dbx-docs-ui-examples manifest format.
 *
 * Each manifest catalogs runnable UI example components scraped from a
 * downstream app's docs module — components that wrap a self-contained
 * `<dbx-docs-ui-example>` template tagged with `@dbxDocsUiExample` JSDoc
 * markers. The merged registry feeds the `dbx_ui_examples` and
 * `dbx_ui_search` MCP tools.
 *
 * Entries reuse the closed UI category vocabulary so cross-cluster joins
 * (e.g. surface examples whose `relatedSlugs` overlap a UI component's slug)
 * stay schema-aligned.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Kinds the resolver may emit for an entry in `uses[]`. Wider than
 * `UiComponentKindValue` because supporting sources can be plain
 * interfaces, type aliases, functions, or constants in addition to Angular
 * constructs.
 */
export const DBX_DOCS_UI_EXAMPLE_USE_KINDS = ['component', 'directive', 'pipe', 'service', 'interface', 'typeAlias', 'function', 'const', 'class'] as const;

/**
 * Static type inferred from {@link DBX_DOCS_UI_EXAMPLE_USE_KINDS}.
 */
export type DbxDocsUiExampleUseKind = (typeof DBX_DOCS_UI_EXAMPLE_USE_KINDS)[number];

// MARK: Uses
/**
 * One supporting source captured by a `@dbxDocsUiExampleUses` tag. The
 * scanner resolves the named identifier through the example component
 * file's import declarations, then captures the declaration source.
 *
 * For inline-template components the template body is already inlined in
 * `classSource`, so it is not duplicated as a separate field. Source
 * file paths are intentionally not persisted because downstream consumers
 * never have access to the originating app's source tree.
 */
export const DbxDocsUiExampleUseEntry = type({
  kind: '"component" | "directive" | "pipe" | "service" | "interface" | "typeAlias" | "function" | "const" | "class"',
  className: 'string',
  'role?': 'string',
  'selector?': 'string',
  'pipeName?': 'string',
  classSource: 'string'
});

/**
 * Static type inferred from {@link DbxDocsUiExampleUseEntry}.
 */
export type DbxDocsUiExampleUseEntry = typeof DbxDocsUiExampleUseEntry.infer;

// MARK: Entry
/**
 * One example entry inside a manifest. Each entry describes a single
 * tagged Angular component whose template is anchored on a
 * `<dbx-docs-ui-example>` wrapper.
 *
 * Required fields are the minimum needed for `dbx_ui_examples` to render
 * a useful answer. `uses` is required (may be empty) so consumers can
 * count on its shape. The wrapper component's source is intentionally
 * not persisted: it imports `<dbx-docs-ui-example*>` scaffolding that
 * only exists inside the originating docs app, so copy-pasting it into
 * a downstream consumer would resolve to non-existent imports. The
 * canonical invocation is captured in `snippet`.
 */
export const DbxDocsUiExampleEntry = type({
  slug: 'string',
  category: '"layout" | "list" | "button" | "card" | "feedback" | "overlay" | "navigation" | "text" | "screen" | "action" | "router" | "misc"',
  summary: 'string',
  header: 'string',
  className: 'string',
  selector: 'string',
  module: 'string',
  appRef: 'string',
  'hint?': 'string',
  'relatedSlugs?': 'string[]',
  'skillRefs?': 'string[]',
  info: 'string',
  snippet: 'string',
  'imports?': 'string',
  'notes?': 'string',
  uses: DbxDocsUiExampleUseEntry.array()
});

/**
 * Static type inferred from {@link DbxDocsUiExampleEntry}.
 */
export type DbxDocsUiExampleEntry = typeof DbxDocsUiExampleEntry.infer;

// MARK: Manifest
/**
 * Top-level manifest envelope. One file per source. The `source` field is
 * the workspace-unique label used to detect collisions; `module` carries
 * the project label (e.g. `apps/demo`) the entries ship in.
 *
 * `version` is the schema version. The loader currently accepts only
 * `version: 1`; manifests with any other value are rejected (strict
 * sources) or warned-and-skipped (non-strict sources).
 */
export const DbxDocsUiExampleManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: DbxDocsUiExampleEntry.array()
});

/**
 * Static type inferred from {@link DbxDocsUiExampleManifest}.
 */
export type DbxDocsUiExampleManifest = typeof DbxDocsUiExampleManifest.infer;
