/**
 * Filters runtime registry wrapper.
 *
 * Wraps the raw {@link LoadFilterManifestsResult} produced by the loader with
 * domain-friendly accessors so the lookup tool and the registry resource
 * don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any entry array via
 * {@link createFilterRegistryFromEntries} to drive the tool without touching
 * disk.
 *
 * Manifest entries (flat, JSON-friendly shape) are converted into the
 * `FilterEntryInfo` shape historically exposed by `tools/data/filter-entries.ts`.
 * The lookup tool keeps consuming that shape so this module is the only seam
 * that changed when the hand-written entries were deleted.
 */

import type { LoadFilterManifestsResult } from '../manifest/filters-loader.js';
import type { FilterEntry } from '../manifest/filters-schema.js';

// MARK: Public types
/**
 * Discriminator between Angular directives (`[dbxFilter*]`) and shape-only
 * patterns (`ClickableFilterPreset`). Mirrors the legacy `FilterEntryKind`
 * exposed by `tools/data/filter-entries.ts`.
 */
export type FilterKind = 'directive' | 'pattern';

/**
 * One documented input on a filter directive — alias, type, description.
 */
export interface FilterEntryInputInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * One curated filter entry surfaced through `dbx_filter_lookup`. Mirrors the
 * legacy hand-written shape so the lookup tool didn't have to be rewritten
 * when the manifest pipeline replaced the inline data table.
 */
export interface FilterEntryInfo {
  readonly slug: string;
  readonly kind: FilterKind;
  readonly className: string;
  readonly selector: string | undefined;
  readonly module: string;
  readonly description: string;
  readonly inputs: readonly FilterEntryInputInfo[];
  readonly outputs: readonly FilterEntryInputInfo[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly example: string;
}

/**
 * Domain-friendly read API over a merged filters manifest set. All accessors
 * return readonly arrays preserving the order the manifests declared their
 * entries (manifests are walked in source order).
 */
export interface FilterRegistry {
  readonly all: readonly FilterEntryInfo[];
  readonly loadedSources: readonly string[];
  readonly kinds: readonly FilterKind[];
  /**
   * Returns the entry whose slug matches `slug` exactly. Slugs are unique
   * across manifests (collisions emit a loader warning and the second-loaded
   * entry wins).
   */
  findBySlug(slug: string): FilterEntryInfo | undefined;
  /**
   * Returns the entry whose TypeScript class name matches `className`
   * (case-insensitive).
   */
  findByClassName(className: string): FilterEntryInfo | undefined;
  /**
   * Returns the directive entry whose `selector` matches `selector`. The
   * lookup tolerates the `[dbxFoo]` attribute form and the bracket-less
   * `dbxFoo` form so callers can use whichever syntax their host context
   * renders.
   */
  findBySelector(selector: string): FilterEntryInfo | undefined;
  /**
   * Returns every entry whose `kind` field matches `kind` exactly, in
   * registry order.
   */
  findByKind(kind: FilterKind): readonly FilterEntryInfo[];
}

/**
 * Stable rendering order for kind buckets in the catalog view.
 */
export const FILTER_KIND_ORDER: readonly FilterKind[] = ['directive', 'pattern'];

// MARK: Construction
/**
 * Builds a {@link FilterRegistry} from a loader result.
 *
 * @param loaded - the merged registry returned by `loadFilterManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createFilterRegistry(loaded: LoadFilterManifestsResult): FilterRegistry {
  const entries = Array.from(loaded.entries.values()).map(toFilterEntryInfo);
  return createFilterRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link FilterRegistry} from a raw {@link FilterEntryInfo} array.
 * Used by tests that need to drive the tool without going through the loader
 * pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createFilterRegistryFromEntries(input: { readonly entries: readonly FilterEntryInfo[]; readonly loadedSources: readonly string[] }): FilterRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, FilterEntryInfo>();
  const byClassName = new Map<string, FilterEntryInfo>();
  const bySelector = new Map<string, FilterEntryInfo>();
  const byKind = new Map<FilterKind, FilterEntryInfo[]>();
  const kindSet = new Set<FilterKind>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    const classKey = entry.className.toLowerCase();
    if (!byClassName.has(classKey)) {
      byClassName.set(classKey, entry);
    }
    if (entry.selector !== undefined) {
      const selectorKey = stripSelectorBrackets(entry.selector);
      if (!bySelector.has(selectorKey)) {
        bySelector.set(selectorKey, entry);
      }
    }
    pushInto(byKind, entry.kind, entry);
    kindSet.add(entry.kind);
  }

  const kinds = FILTER_KIND_ORDER.filter((k) => kindSet.has(k));

  const registry: FilterRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    kinds,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findByClassName(className) {
      return byClassName.get(className.toLowerCase());
    },
    findBySelector(selector) {
      return bySelector.get(stripSelectorBrackets(selector.trim()));
    },
    findByKind(kind) {
      return byKind.get(kind) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no filters
 * manifest sources to load. Tools wired against this registry behave like
 * a registry that loaded successfully with zero entries.
 */
export const EMPTY_FILTER_REGISTRY: FilterRegistry = createFilterRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the {@link FilterEntryInfo} shape the lookup
 * tool consumes. Pattern entries (no `@Directive` decorator) carry an
 * `undefined` selector and empty inputs/outputs.
 *
 * @param entry - the manifest entry to convert
 * @returns the matching FilterEntryInfo
 */
export function toFilterEntryInfo(entry: FilterEntry): FilterEntryInfo {
  let result: FilterEntryInfo;
  if (entry.kind === 'directive') {
    result = {
      slug: entry.slug,
      kind: 'directive',
      className: entry.className,
      selector: entry.selector,
      module: entry.module,
      description: entry.description,
      inputs: entry.inputs.map((i) => ({ name: i.name, type: i.type, description: i.description })),
      outputs: entry.outputs.map((o) => ({ name: o.name, type: o.type, description: o.description })),
      relatedSlugs: entry.relatedSlugs ?? [],
      skillRefs: entry.skillRefs ?? [],
      example: entry.example
    };
  } else {
    result = {
      slug: entry.slug,
      kind: 'pattern',
      className: entry.className,
      selector: undefined,
      module: entry.module,
      description: entry.description,
      inputs: [],
      outputs: [],
      relatedSlugs: entry.relatedSlugs ?? [],
      skillRefs: entry.skillRefs ?? [],
      example: entry.example
    };
  }
  return result;
}

// MARK: Internals
function pushInto<K>(map: Map<K, FilterEntryInfo[]>, key: K, entry: FilterEntryInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}

function stripSelectorBrackets(selector: string): string {
  return selector.startsWith('[') && selector.endsWith(']') ? selector.slice(1, -1) : selector;
}
