/**
 * Model-firebase-index runtime registry wrapper.
 *
 * Wraps the raw {@link LoadModelFirebaseIndexManifestsResult} produced by
 * the loader with domain-friendly accessors so the lookup/search tools
 * and the registry resource don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any entry array via
 * {@link createModelFirebaseIndexRegistryFromEntries} to drive the tools
 * without touching disk.
 */

import type { ConstraintSequence, DerivedComposite, DerivedFieldOverride, FirestoreQueryScope, ModelFirebaseIndexEntry, ModelFirebaseIndexParamEntry } from './model-firebase-index-schema.js';

/**
 * Subset of the `LoadModelFirebaseIndexManifestsResult` shape (defined by
 * `model-firebase-index-loader.ts` in `@dereekb/dbx-components-mcp`) that
 * `createModelFirebaseIndexRegistry` consumes. Inlined here so this
 * runtime stays free of any back-import into the MCP server package.
 *
 * `warnings` is typed as `readonly unknown[]` because the registry never
 * reads them — the loader collects them and surfaces them through its own
 * (more strongly typed) return shape. Any `readonly Warning[]` is
 * structurally assignable to `readonly unknown[]`.
 */
export interface LoadModelFirebaseIndexManifestsResult {
  readonly entries: ReadonlyMap<string, ModelFirebaseIndexEntry>;
  readonly collectionIndex: ReadonlyMap<string, readonly string[]>;
  readonly warnings: readonly unknown[];
  readonly loadedSources: readonly string[];
}

// MARK: Public types
/**
 * One curated firebase-index entry surfaced through the
 * `dbx_model_firebase_index_*` tools.
 *
 * Mirrors {@link ModelFirebaseIndexEntry} but normalises optional manifest
 * fields to empty arrays / safe defaults so callers (lookup, search,
 * resources) don't have to defensively branch.
 */
export interface ModelFirebaseIndexEntryInfo {
  readonly slug: string;
  readonly name: string;
  readonly module: string;
  readonly subpath: string;
  readonly signature: string;
  readonly description: string;
  readonly model: string;
  readonly collection: string;
  readonly isNested: boolean;
  readonly scope: FirestoreQueryScope;
  readonly manual: boolean;
  readonly skip: boolean;
  readonly category: string;
  readonly params: readonly ModelFirebaseIndexParamEntry[];
  readonly returns: string;
  readonly tags: readonly string[];
  readonly constraintSequences: readonly ConstraintSequence[];
  readonly derivedComposites: readonly DerivedComposite[];
  readonly derivedFieldOverrides: readonly DerivedFieldOverride[];
  readonly example: string;
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly deprecated: boolean | string;
  readonly since: string;
}

/**
 * Domain-friendly read API over a merged model-firebase-index manifest set.
 * All accessors return readonly arrays preserving the order the manifests
 * declared their entries.
 */
export interface ModelFirebaseIndexRegistry {
  readonly all: readonly ModelFirebaseIndexEntryInfo[];
  readonly loadedSources: readonly string[];
  readonly collections: readonly string[];
  readonly models: readonly string[];
  readonly modules: readonly string[];
  readonly categories: readonly string[];
  findBySlug(slug: string): ModelFirebaseIndexEntryInfo | undefined;
  findByName(name: string): ModelFirebaseIndexEntryInfo | undefined;
  findByCollection(collection: string): readonly ModelFirebaseIndexEntryInfo[];
  findByModel(model: string): readonly ModelFirebaseIndexEntryInfo[];
  findByModule(module: string): readonly ModelFirebaseIndexEntryInfo[];
  findByCategory(category: string): readonly ModelFirebaseIndexEntryInfo[];
  findByTag(tag: string): readonly ModelFirebaseIndexEntryInfo[];
}

// MARK: Construction
/**
 * Builds a {@link ModelFirebaseIndexRegistry} from a loader result.
 *
 * @param loaded - The merged registry returned by `loadModelFirebaseIndexManifests`
 * @returns A domain-friendly read API over the merged entries.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createModelFirebaseIndexRegistry(loaded: LoadModelFirebaseIndexManifestsResult): ModelFirebaseIndexRegistry {
  const entries = Array.from(loaded.entries.values()).map(toModelFirebaseIndexEntryInfo);
  return createModelFirebaseIndexRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link ModelFirebaseIndexRegistry} from a raw entry array.
 * Used by tests that need to drive the tools without going through the
 * loader pipeline.
 *
 * @param input - The entries plus the source labels to advertise.
 * @param input.entries - The full entry list.
 * @param input.loadedSources - Source labels reported via `registry.loadedSources`
 * @returns A domain-friendly read API over the supplied entries.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createModelFirebaseIndexRegistryFromEntries(input: { readonly entries: readonly ModelFirebaseIndexEntryInfo[]; readonly loadedSources: readonly string[] }): ModelFirebaseIndexRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, ModelFirebaseIndexEntryInfo>();
  const byName = new Map<string, ModelFirebaseIndexEntryInfo>();
  const byCollection = new Map<string, ModelFirebaseIndexEntryInfo[]>();
  const byModel = new Map<string, ModelFirebaseIndexEntryInfo[]>();
  const byModule = new Map<string, ModelFirebaseIndexEntryInfo[]>();
  const byCategory = new Map<string, ModelFirebaseIndexEntryInfo[]>();
  const byTag = new Map<string, ModelFirebaseIndexEntryInfo[]>();
  const collectionSet = new Set<string>();
  const modelSet = new Set<string>();
  const moduleSet = new Set<string>();
  const categorySet = new Set<string>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    if (!byName.has(entry.name)) {
      byName.set(entry.name, entry);
    }
    pushInto(byCollection, entry.collection, entry);
    pushInto(byModel, entry.model, entry);
    pushInto(byModule, entry.module, entry);
    pushInto(byCategory, entry.category, entry);
    for (const tag of entry.tags) {
      pushInto(byTag, tag.toLowerCase(), entry);
    }
    collectionSet.add(entry.collection);
    modelSet.add(entry.model);
    moduleSet.add(entry.module);
    categorySet.add(entry.category);
  }

  const collections = Array.from(collectionSet).sort((a, b) => a.localeCompare(b));
  const models = Array.from(modelSet).sort((a, b) => a.localeCompare(b));
  const modules = Array.from(moduleSet).sort((a, b) => a.localeCompare(b));
  const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

  return {
    all,
    loadedSources: [...input.loadedSources],
    collections,
    models,
    modules,
    categories,
    findBySlug: (slug) => bySlug.get(slug),
    findByName: (name) => byName.get(name),
    findByCollection: (collection) => byCollection.get(collection) ?? [],
    findByModel: (model) => byModel.get(model) ?? [],
    findByModule: (module) => byModule.get(module) ?? [],
    findByCategory: (category) => byCategory.get(category) ?? [],
    findByTag: (tag) => byTag.get(tag.toLowerCase()) ?? []
  };
}

/**
 * Empty registry suitable as a default when the server has no
 * model-firebase-index manifest sources to load. Tools wired against
 * this registry behave like a registry that loaded successfully with
 * zero entries.
 */
export const EMPTY_MODEL_FIREBASE_INDEX_REGISTRY: ModelFirebaseIndexRegistry = createModelFirebaseIndexRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the {@link ModelFirebaseIndexEntryInfo}
 * shape the lookup/search tools consume. Optional manifest fields fall
 * back to safe defaults so a partially-populated entry still renders
 * cleanly.
 *
 * @param entry - The manifest entry to convert.
 * @returns The matching ModelFirebaseIndexEntryInfo.
 */
export function toModelFirebaseIndexEntryInfo(entry: ModelFirebaseIndexEntry): ModelFirebaseIndexEntryInfo {
  return {
    slug: entry.slug,
    name: entry.name,
    module: entry.module,
    subpath: entry.subpath,
    signature: entry.signature,
    description: entry.description,
    model: entry.model,
    collection: entry.collection,
    isNested: entry.isNested,
    scope: entry.scope,
    manual: entry.manual,
    skip: entry.skip,
    category: entry.category,
    params: entry.params.map((p) => ({ ...p })),
    returns: entry.returns,
    tags: [...entry.tags],
    constraintSequences: entry.constraintSequences.map((s) => ({
      ...(s.pathLabel === undefined ? {} : { pathLabel: s.pathLabel }),
      entries: s.entries.map((e) => ({ ...e }))
    })),
    derivedComposites: entry.derivedComposites.map((c) => ({ ...c, fields: c.fields.map((f) => ({ ...f })) })),
    derivedFieldOverrides: entry.derivedFieldOverrides.map((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v })) })),
    example: entry.example ?? '',
    relatedSlugs: entry.relatedSlugs ?? [],
    skillRefs: entry.skillRefs ?? [],
    deprecated: entry.deprecated ?? false,
    since: entry.since ?? ''
  };
}

// MARK: Internals
function pushInto<K>(map: Map<K, ModelFirebaseIndexEntryInfo[]>, key: K, entry: ModelFirebaseIndexEntryInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}
