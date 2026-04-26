/**
 * Semantic-types registry wrapper.
 *
 * Wraps the raw {@link LoadSemanticTypeManifestsResult} produced by the
 * loader with domain-friendly accessors so the lookup / search tools and
 * the registry resource don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup (see Step 6) and passed
 * into the tool factories. Tests can construct a registry from any
 * `SemanticTypeEntry` array via {@link createSemanticTypeRegistryFromEntries}
 * to drive the tools without touching disk.
 */

import type { LoadSemanticTypeManifestsResult } from '../manifest/loader.js';
import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';

// MARK: Public types
/**
 * Domain-friendly read API over a merged semantic-types manifest set. All
 * accessors return readonly arrays sorted by name to keep tool output
 * deterministic.
 */
export interface SemanticTypeRegistry {
  readonly all: readonly SemanticTypeEntry[];
  readonly loadedSources: readonly string[];
  readonly topics: readonly string[];
  readonly packages: readonly string[];
  readonly baseTypes: readonly string[];
  /**
   * Returns every entry that matches `name` exactly. Names are case-sensitive.
   */
  findByName(name: string): readonly SemanticTypeEntry[];
  /**
   * Returns every entry tagged with `topic`. Topics are case-sensitive.
   */
  findByTopic(topic: string): readonly SemanticTypeEntry[];
  /**
   * Returns every entry whose `package` field matches `packageLabel` exactly.
   */
  findByPackage(packageLabel: string): readonly SemanticTypeEntry[];
  /**
   * Returns every entry whose `baseType` matches `baseType` exactly.
   */
  findByBaseType(baseType: string): readonly SemanticTypeEntry[];
  /**
   * Substring search across `name`, `module`, and `definition`. Case-
   * insensitive.
   */
  findByQuery(query: string): readonly SemanticTypeEntry[];
}

// MARK: Construction
/**
 * Builds a {@link SemanticTypeRegistry} from a loader result. The wrapper
 * keeps a single sorted-by-name copy of every entry plus pre-computed
 * topic / package / baseType buckets so each lookup is O(n) at worst and
 * subsequent calls hit the cached bucket lists.
 *
 * @param loaded - the merged registry returned by `loadSemanticTypeManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createSemanticTypeRegistry(loaded: LoadSemanticTypeManifestsResult): SemanticTypeRegistry {
  const entries = Array.from(loaded.entries.values()).sort((a, b) => a.name.localeCompare(b.name));
  return createSemanticTypeRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link SemanticTypeRegistry} from a raw entry array. Used by tests
 * that need to drive the tools without going through the loader pipeline.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list (will be sorted by name)
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createSemanticTypeRegistryFromEntries(input: { readonly entries: readonly SemanticTypeEntry[]; readonly loadedSources: readonly string[] }): SemanticTypeRegistry {
  const all = [...input.entries].sort((a, b) => a.name.localeCompare(b.name));

  const byName = new Map<string, SemanticTypeEntry[]>();
  const byTopic = new Map<string, SemanticTypeEntry[]>();
  const byPackage = new Map<string, SemanticTypeEntry[]>();
  const byBaseType = new Map<string, SemanticTypeEntry[]>();

  for (const entry of all) {
    pushInto(byName, entry.name, entry);
    pushInto(byPackage, entry.package, entry);
    pushInto(byBaseType, entry.baseType, entry);
    for (const topic of entry.topics) {
      pushInto(byTopic, topic, entry);
    }
  }

  const topics = sortedKeys(byTopic);
  const packages = sortedKeys(byPackage);
  const baseTypes = sortedKeys(byBaseType);

  const registry: SemanticTypeRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    topics,
    packages,
    baseTypes,
    findByName(name) {
      return byName.get(name) ?? [];
    },
    findByTopic(topic) {
      return byTopic.get(topic) ?? [];
    },
    findByPackage(packageLabel) {
      return byPackage.get(packageLabel) ?? [];
    },
    findByBaseType(baseType) {
      return byBaseType.get(baseType) ?? [];
    },
    findByQuery(query) {
      const trimmed = query.trim().toLowerCase();
      let matches: readonly SemanticTypeEntry[];
      if (trimmed.length === 0) {
        matches = [];
      } else {
        matches = all.filter((entry) => {
          const haystack = `${entry.name}\n${entry.module}\n${entry.definition}`.toLowerCase();
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
export const EMPTY_SEMANTIC_TYPE_REGISTRY: SemanticTypeRegistry = createSemanticTypeRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Internals
function pushInto(map: Map<string, SemanticTypeEntry[]>, key: string, entry: SemanticTypeEntry): void {
  const existing = map.get(key);
  if (existing !== undefined) {
    existing.push(entry);
  } else {
    map.set(key, [entry]);
  }
}

function sortedKeys(map: Map<string, unknown>): readonly string[] {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
}
