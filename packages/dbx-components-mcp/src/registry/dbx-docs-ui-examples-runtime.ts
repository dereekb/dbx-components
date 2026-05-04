/**
 * dbx-docs-ui-examples runtime registry wrapper.
 *
 * Wraps the merged manifest result with domain-friendly accessors so the
 * `dbx_ui_examples` and `dbx_ui_search` tools can query entries without
 * walking Maps directly. Mirrors `ui-components-runtime.ts`: registry is
 * loaded once at server startup and passed into the tool factories.
 */

import type { LoadDbxDocsUiExamplesManifestsResult } from '../manifest/dbx-docs-ui-examples-loader.js';
import type { DbxDocsUiExampleEntry } from '../manifest/dbx-docs-ui-examples-schema.js';

// MARK: Public types
export interface DbxDocsUiExamplesRegistry {
  readonly all: readonly DbxDocsUiExampleEntry[];
  readonly loadedSources: readonly string[];
  readonly categories: readonly string[];
  readonly modules: readonly string[];
  /**
   * Returns the entry whose slug matches exactly. Slugs are
   * case-sensitive; collisions across modules are resolved at load time.
   */
  findBySlug(slug: string): DbxDocsUiExampleEntry | undefined;
  /**
   * Returns every entry whose `category` field matches exactly.
   */
  findByCategory(category: string): readonly DbxDocsUiExampleEntry[];
  /**
   * Returns every entry whose `relatedSlugs` contains the supplied UI
   * component slug. Used by `dbx_ui_search` to surface relevant examples
   * alongside component results.
   */
  findRelatedTo(uiComponentSlug: string): readonly DbxDocsUiExampleEntry[];
}

// MARK: Construction
export function createDbxDocsUiExamplesRegistry(loaded: LoadDbxDocsUiExamplesManifestsResult): DbxDocsUiExamplesRegistry {
  const entries = Array.from(loaded.entries.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  return createDbxDocsUiExamplesRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

export function createDbxDocsUiExamplesRegistryFromEntries(input: { readonly entries: readonly DbxDocsUiExampleEntry[]; readonly loadedSources: readonly string[] }): DbxDocsUiExamplesRegistry {
  const all = [...input.entries].sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map<string, DbxDocsUiExampleEntry>();
  const byCategory = new Map<string, DbxDocsUiExampleEntry[]>();
  const byModule = new Map<string, DbxDocsUiExampleEntry[]>();
  const byRelated = new Map<string, DbxDocsUiExampleEntry[]>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    pushInto(byCategory, entry.category, entry);
    pushInto(byModule, entry.module, entry);
    for (const related of entry.relatedSlugs ?? []) {
      pushInto(byRelated, related, entry);
    }
  }

  const categories = sortedKeys(byCategory);
  const modules = sortedKeys(byModule);

  return {
    all,
    loadedSources: [...input.loadedSources],
    categories,
    modules,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findByCategory(category) {
      return byCategory.get(category) ?? [];
    },
    findRelatedTo(uiComponentSlug) {
      return byRelated.get(uiComponentSlug) ?? [];
    }
  };
}

/**
 * Empty registry suitable as a default when no example manifests are
 * configured. Tools wired against this behave like an empty cluster —
 * "no examples" rather than crashing.
 */
export const EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY: DbxDocsUiExamplesRegistry = createDbxDocsUiExamplesRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Internals
function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }
}

function sortedKeys(map: Map<string, unknown>): readonly string[] {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}
