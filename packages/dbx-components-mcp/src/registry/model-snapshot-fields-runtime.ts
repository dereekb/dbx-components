/**
 * Model-snapshot-fields runtime registry wrapper.
 *
 * Wraps the raw {@link LoadModelSnapshotFieldManifestsResult} produced by
 * the loader with domain-friendly accessors so the lookup/search tools and
 * the registry resource don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any entry array via
 * {@link createModelSnapshotFieldRegistryFromEntries} to drive the tools
 * without touching disk.
 */

import type { LoadModelSnapshotFieldManifestsResult } from '../manifest/model-snapshot-fields-loader.js';
import type { ModelSnapshotFieldEntry } from '../manifest/model-snapshot-fields-schema.js';

// MARK: Public types
/**
 * Closed kind vocabulary describing the shape of one snapshot-field entry.
 */
export type ModelSnapshotFieldKind = 'factory' | 'const';

/**
 * One documented parameter of a factory snapshot field.
 */
export interface ModelSnapshotFieldParamInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly optional: boolean;
}

/**
 * One curated snapshot-field entry surfaced through the
 * `dbx_model_snapshot_field_*` tools.
 *
 * Mirrors {@link ModelSnapshotFieldEntry} but normalises optional manifest
 * fields to empty arrays / safe defaults so callers (lookup, search,
 * resources) don't have to defensively branch.
 */
export interface ModelSnapshotFieldEntryInfo {
  readonly slug: string;
  readonly name: string;
  readonly kind: ModelSnapshotFieldKind;
  readonly category: string;
  readonly module: string;
  readonly subpath: string;
  readonly signature: string;
  readonly description: string;
  readonly optional: boolean;
  readonly params: readonly ModelSnapshotFieldParamInfo[];
  readonly returns: string;
  readonly tags: readonly string[];
  readonly example: string;
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly deprecated: boolean | string;
  readonly since: string;
}

/**
 * Domain-friendly read API over a merged model-snapshot-fields manifest set.
 * All accessors return readonly arrays preserving the order the manifests
 * declared their entries (manifests are walked in source order).
 */
export interface ModelSnapshotFieldRegistry {
  readonly all: readonly ModelSnapshotFieldEntryInfo[];
  readonly loadedSources: readonly string[];
  readonly categories: readonly string[];
  readonly modules: readonly string[];
  /**
   * Returns the entry whose slug matches `slug` exactly. Slugs are unique
   * across manifests (collisions emit a loader warning and the
   * second-loaded entry wins).
   */
  findBySlug(slug: string): ModelSnapshotFieldEntryInfo | undefined;
  /**
   * Returns the entry whose exported identifier matches `name`. Lookup is
   * case-sensitive — most snapshot-field names are camelCase.
   */
  findByName(name: string): ModelSnapshotFieldEntryInfo | undefined;
  /**
   * Returns the entry whose exported identifier matches `name`
   * case-insensitively. Falls back to the case-sensitive path first to
   * keep camelCase hits prioritised.
   */
  findByNameInsensitive(name: string): ModelSnapshotFieldEntryInfo | undefined;
  /**
   * Returns every entry whose `category` field matches `category` exactly,
   * in registry order.
   */
  findByCategory(category: string): readonly ModelSnapshotFieldEntryInfo[];
  /**
   * Returns every entry whose `module` field matches `module` exactly, in
   * registry order.
   */
  findByModule(module: string): readonly ModelSnapshotFieldEntryInfo[];
  /**
   * Returns every entry whose `tags` array includes `tag` (case-sensitive,
   * tags are stored lowercased), in registry order.
   */
  findByTag(tag: string): readonly ModelSnapshotFieldEntryInfo[];
}

// MARK: Construction
/**
 * Builds a {@link ModelSnapshotFieldRegistry} from a loader result.
 *
 * @param loaded - the merged registry returned by `loadModelSnapshotFieldManifests`
 * @returns a domain-friendly read API over the merged entries
 * @__NO_SIDE_EFFECTS__
 */
export function createModelSnapshotFieldRegistry(loaded: LoadModelSnapshotFieldManifestsResult): ModelSnapshotFieldRegistry {
  const entries = Array.from(loaded.entries.values()).map(toModelSnapshotFieldEntryInfo);
  return createModelSnapshotFieldRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link ModelSnapshotFieldRegistry} from a raw
 * {@link ModelSnapshotFieldEntryInfo} array. Used by tests that need to
 * drive the tools without going through the loader pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 * @__NO_SIDE_EFFECTS__
 */
export function createModelSnapshotFieldRegistryFromEntries(input: { readonly entries: readonly ModelSnapshotFieldEntryInfo[]; readonly loadedSources: readonly string[] }): ModelSnapshotFieldRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, ModelSnapshotFieldEntryInfo>();
  const byName = new Map<string, ModelSnapshotFieldEntryInfo>();
  const byNameLower = new Map<string, ModelSnapshotFieldEntryInfo>();
  const byCategory = new Map<string, ModelSnapshotFieldEntryInfo[]>();
  const byModule = new Map<string, ModelSnapshotFieldEntryInfo[]>();
  const byTag = new Map<string, ModelSnapshotFieldEntryInfo[]>();
  const categorySet = new Set<string>();
  const moduleSet = new Set<string>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
    const nameLower = entry.name.toLowerCase();
    if (!byNameLower.has(nameLower)) {
      byNameLower.set(nameLower, entry);
    }
    pushInto(byCategory, entry.category, entry);
    pushInto(byModule, entry.module, entry);
    for (const tag of entry.tags) {
      pushInto(byTag, tag.toLowerCase(), entry);
    }
    categorySet.add(entry.category);
    moduleSet.add(entry.module);
  }

  const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  const modules = Array.from(moduleSet).sort((a, b) => a.localeCompare(b));

  const registry: ModelSnapshotFieldRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    categories,
    modules,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findByName(name) {
      return byName.get(name);
    },
    findByNameInsensitive(name) {
      return byName.get(name) ?? byNameLower.get(name.toLowerCase());
    },
    findByCategory(category) {
      return byCategory.get(category) ?? [];
    },
    findByModule(module) {
      return byModule.get(module) ?? [];
    },
    findByTag(tag) {
      return byTag.get(tag.toLowerCase()) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no
 * model-snapshot-fields manifest sources to load. Tools wired against this
 * registry behave like a registry that loaded successfully with zero
 * entries.
 */
export const EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY: ModelSnapshotFieldRegistry = createModelSnapshotFieldRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the {@link ModelSnapshotFieldEntryInfo}
 * shape the lookup/search tools consume. Optional manifest fields fall
 * back to safe defaults so a partially-populated entry still renders cleanly.
 *
 * @param entry - the manifest entry to convert
 * @returns the matching ModelSnapshotFieldEntryInfo
 */
export function toModelSnapshotFieldEntryInfo(entry: ModelSnapshotFieldEntry): ModelSnapshotFieldEntryInfo {
  const result: ModelSnapshotFieldEntryInfo = {
    slug: entry.slug,
    name: entry.name,
    kind: entry.kind,
    category: entry.category,
    module: entry.module,
    subpath: entry.subpath,
    signature: entry.signature,
    description: entry.description,
    optional: entry.optional,
    params: entry.params.map((p) => ({ name: p.name, type: p.type, description: p.description, optional: p.optional })),
    returns: entry.returns,
    tags: [...entry.tags],
    example: entry.example ?? '',
    relatedSlugs: entry.relatedSlugs ?? [],
    skillRefs: entry.skillRefs ?? [],
    deprecated: entry.deprecated ?? false,
    since: entry.since ?? ''
  };
  return result;
}

// MARK: Internals
function pushInto<K>(map: Map<K, ModelSnapshotFieldEntryInfo[]>, key: K, entry: ModelSnapshotFieldEntryInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}
