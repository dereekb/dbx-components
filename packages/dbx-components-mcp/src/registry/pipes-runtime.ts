/**
 * Pipes runtime registry wrapper.
 *
 * Wraps the raw {@link LoadPipeManifestsResult} produced by the loader with
 * domain-friendly accessors so the lookup tool and the registry resource
 * don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any entry array via
 * {@link createPipeRegistryFromEntries} to drive the tool without touching
 * disk.
 *
 * Manifest entries (flat, JSON-friendly shape) are converted into the
 * `PipeEntryInfo` shape historically exposed by `tools/data/pipe-entries.ts`.
 * The lookup tool keeps consuming that shape so this module is the only seam
 * that changed when the hand-written entries were deleted.
 */

import type { LoadPipeManifestsResult } from '../manifest/pipes-loader.js';
import type { PipeEntry } from '../manifest/pipes-schema.js';

// MARK: Public types
/**
 * Browse-friendly category grouping. Mirrors the on-disk folder layout of
 * `packages/dbx-core/src/lib/pipe/` and the `category` field on every
 * manifest entry.
 */
export type PipeCategory = 'value' | 'date' | 'async' | 'misc';

/**
 * Whether the pipe is `pure: true` (default — runs only when the reference
 * to its inputs change) or `pure: false` (runs on every change detection).
 */
export type PipePurity = 'pure' | 'impure';

/**
 * One documented argument supplied to the pipe `transform()` method on top
 * of the piped value (e.g. `{{ value | dollarAmount:'N/A' }}` — `'N/A'` is
 * the `defaultIfNull` argument).
 */
export interface PipeEntryArgInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
}

/**
 * One curated pipe entry surfaced through `dbx_pipe_lookup`. Mirrors the
 * legacy hand-written shape so the lookup tool didn't have to be rewritten
 * when the manifest pipeline replaced the inline data table.
 */
export interface PipeEntryInfo {
  readonly slug: string;
  readonly category: PipeCategory;
  readonly pipeName: string;
  readonly className: string;
  readonly module: string;
  readonly inputType: string;
  readonly outputType: string;
  readonly purity: PipePurity;
  readonly description: string;
  readonly args: readonly PipeEntryArgInfo[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly example: string;
}

/**
 * Domain-friendly read API over a merged pipes manifest set. All accessors
 * return readonly arrays preserving the order the manifests declared their
 * entries (manifests are walked in source order).
 */
export interface PipeRegistry {
  readonly all: readonly PipeEntryInfo[];
  readonly loadedSources: readonly string[];
  readonly categories: readonly PipeCategory[];
  /**
   * Returns the entry whose slug matches `slug` exactly. Slugs are unique
   * across manifests (collisions emit a loader warning and the second-loaded
   * entry wins).
   */
  findBySlug(slug: string): PipeEntryInfo | undefined;
  /**
   * Returns the entry whose Angular pipe name matches `pipeName` (case
   * sensitive — Angular pipe names are camelCase).
   */
  findByPipeName(pipeName: string): PipeEntryInfo | undefined;
  /**
   * Returns the entry whose TypeScript class name matches `className`
   * (case-insensitive).
   */
  findByClassName(className: string): PipeEntryInfo | undefined;
  /**
   * Returns every entry whose `category` field matches `category` exactly,
   * in registry order.
   */
  findByCategory(category: PipeCategory): readonly PipeEntryInfo[];
}

/**
 * Stable rendering order for category buckets in the catalog view.
 */
export const PIPE_CATEGORY_ORDER: readonly PipeCategory[] = ['value', 'date', 'async', 'misc'];

// MARK: Construction
/**
 * Builds a {@link PipeRegistry} from a loader result.
 *
 * @param loaded - the merged registry returned by `loadPipeManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createPipeRegistry(loaded: LoadPipeManifestsResult): PipeRegistry {
  const entries = Array.from(loaded.entries.values()).map(toPipeEntryInfo);
  return createPipeRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link PipeRegistry} from a raw {@link PipeEntryInfo} array. Used
 * by tests that need to drive the tool without going through the loader
 * pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createPipeRegistryFromEntries(input: { readonly entries: readonly PipeEntryInfo[]; readonly loadedSources: readonly string[] }): PipeRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, PipeEntryInfo>();
  const byPipeName = new Map<string, PipeEntryInfo>();
  const byClassName = new Map<string, PipeEntryInfo>();
  const byCategory = new Map<PipeCategory, PipeEntryInfo[]>();
  const categorySet = new Set<PipeCategory>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    if (!byPipeName.has(entry.pipeName)) {
      byPipeName.set(entry.pipeName, entry);
    }
    const classKey = entry.className.toLowerCase();
    if (!byClassName.has(classKey)) {
      byClassName.set(classKey, entry);
    }
    pushInto(byCategory, entry.category, entry);
    categorySet.add(entry.category);
  }

  const categories = PIPE_CATEGORY_ORDER.filter((c) => categorySet.has(c));

  const registry: PipeRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    categories,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findByPipeName(pipeName) {
      return byPipeName.get(pipeName);
    },
    findByClassName(className) {
      return byClassName.get(className.toLowerCase());
    },
    findByCategory(category) {
      return byCategory.get(category) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no pipes manifest
 * sources to load. Tools wired against this registry behave like a registry
 * that loaded successfully with zero entries.
 */
export const EMPTY_PIPE_REGISTRY: PipeRegistry = createPipeRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the {@link PipeEntryInfo} shape the lookup
 * tool consumes. Optional manifest fields fall back to safe defaults so a
 * partially-populated entry still renders cleanly.
 *
 * @param entry - the manifest entry to convert
 * @returns the matching PipeEntryInfo
 */
export function toPipeEntryInfo(entry: PipeEntry): PipeEntryInfo {
  const result: PipeEntryInfo = {
    slug: entry.slug,
    category: entry.category,
    pipeName: entry.pipeName,
    className: entry.className,
    module: entry.module,
    inputType: entry.inputType,
    outputType: entry.outputType,
    purity: entry.purity,
    description: entry.description,
    args: entry.args.map((a) => ({ name: a.name, type: a.type, description: a.description, required: a.required })),
    relatedSlugs: entry.relatedSlugs ?? [],
    skillRefs: entry.skillRefs ?? [],
    example: entry.example
  };
  return result;
}

// MARK: Internals
function pushInto<K>(map: Map<K, PipeEntryInfo[]>, key: K, entry: PipeEntryInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}
