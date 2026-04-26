/**
 * UI components runtime registry wrapper.
 *
 * Wraps the raw {@link LoadUiComponentManifestsResult} produced by the
 * loader with domain-friendly accessors so the lookup / search tools and
 * the registry resource don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any `UiComponentEntry`
 * array via {@link createUiComponentRegistryFromEntries} to drive the
 * tools without touching disk.
 */

import type { LoadUiComponentManifestsResult } from '../manifest/ui-components-loader.js';
import type { UiComponentEntry } from '../manifest/ui-components-schema.js';

// MARK: Public types
/**
 * Domain-friendly read API over a merged ui-components manifest set. All
 * accessors return readonly arrays sorted by slug to keep tool output
 * deterministic.
 */
export interface UiComponentRegistry {
  readonly all: readonly UiComponentEntry[];
  readonly loadedSources: readonly string[];
  readonly categories: readonly string[];
  readonly kinds: readonly string[];
  readonly modules: readonly string[];
  /**
   * Returns every entry whose slug matches `slug` exactly. Slugs are
   * case-sensitive.
   */
  findBySlug(slug: string): readonly UiComponentEntry[];
  /**
   * Returns every entry whose `category` field matches exactly. Categories
   * are case-sensitive.
   */
  findByCategory(category: string): readonly UiComponentEntry[];
  /**
   * Returns every entry whose `kind` field matches exactly.
   */
  findByKind(kind: string): readonly UiComponentEntry[];
  /**
   * Returns the entry whose `selector` includes the supplied string as
   * one of its comma-separated tokens. Selector tokens are matched
   * verbatim including the bracket form (`[dbxAction]`).
   */
  findBySelector(selector: string): UiComponentEntry | undefined;
  /**
   * Returns the entry whose `className` matches the supplied string
   * (case-insensitive).
   */
  findByClassName(className: string): UiComponentEntry | undefined;
  /**
   * Substring search across `slug`, `selector`, `className`, and
   * `description`. Case-insensitive.
   */
  findByQuery(query: string): readonly UiComponentEntry[];
}

// MARK: Construction
/**
 * Builds a {@link UiComponentRegistry} from a loader result. The wrapper
 * keeps a single sorted-by-slug copy of every entry plus pre-computed
 * category / kind / module buckets so each lookup is O(n) at worst and
 * subsequent calls hit the cached bucket lists.
 *
 * @param loaded - the merged registry returned by `loadUiComponentManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createUiComponentRegistry(loaded: LoadUiComponentManifestsResult): UiComponentRegistry {
  const entries = Array.from(loaded.entries.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  return createUiComponentRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link UiComponentRegistry} from a raw entry array. Used by tests
 * that need to drive the tools without going through the loader pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list (will be sorted by slug)
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createUiComponentRegistryFromEntries(input: { readonly entries: readonly UiComponentEntry[]; readonly loadedSources: readonly string[] }): UiComponentRegistry {
  const all = [...input.entries].sort((a, b) => a.slug.localeCompare(b.slug));

  const bySlug = new Map<string, UiComponentEntry[]>();
  const byCategory = new Map<string, UiComponentEntry[]>();
  const byKind = new Map<string, UiComponentEntry[]>();
  const byModule = new Map<string, UiComponentEntry[]>();
  const byClassName = new Map<string, UiComponentEntry>();
  const bySelectorToken = new Map<string, UiComponentEntry>();

  for (const entry of all) {
    pushInto(bySlug, entry.slug, entry);
    pushInto(byCategory, entry.category, entry);
    pushInto(byKind, entry.kind, entry);
    pushInto(byModule, entry.module, entry);
    byClassName.set(entry.className.toLowerCase(), entry);
    for (const token of splitSelectorTokens(entry.selector)) {
      if (!bySelectorToken.has(token)) {
        bySelectorToken.set(token, entry);
      }
    }
  }

  const categories = sortedKeys(byCategory);
  const kinds = sortedKeys(byKind);
  const modules = sortedKeys(byModule);

  const registry: UiComponentRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    categories,
    kinds,
    modules,
    findBySlug(slug) {
      return bySlug.get(slug) ?? [];
    },
    findByCategory(category) {
      return byCategory.get(category) ?? [];
    },
    findByKind(kind) {
      return byKind.get(kind) ?? [];
    },
    findBySelector(selector) {
      return bySelectorToken.get(selector.trim());
    },
    findByClassName(className) {
      return byClassName.get(className.toLowerCase());
    },
    findByQuery(query) {
      const trimmed = query.trim().toLowerCase();
      let matches: readonly UiComponentEntry[];
      if (trimmed.length === 0) {
        matches = [];
      } else {
        matches = all.filter((entry) => {
          const haystack = `${entry.slug}\n${entry.selector}\n${entry.className}\n${entry.description}`.toLowerCase();
          return haystack.includes(trimmed);
        });
      }
      return matches;
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no manifest
 * sources to load. Tools wired against this registry behave like a
 * registry that loaded successfully with zero entries — they emit
 * "no results" responses rather than crashing.
 */
export const EMPTY_UI_COMPONENT_REGISTRY: UiComponentRegistry = createUiComponentRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Internals
function pushInto(map: Map<string, UiComponentEntry[]>, key: string, entry: UiComponentEntry): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}

function sortedKeys(map: Map<string, unknown>): readonly string[] {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}

function splitSelectorTokens(selector: string): readonly string[] {
  const out: string[] = [];
  for (const piece of selector.split(',')) {
    const trimmed = piece.trim();
    if (trimmed.length > 0) {
      out.push(trimmed);
    }
  }
  return out;
}
