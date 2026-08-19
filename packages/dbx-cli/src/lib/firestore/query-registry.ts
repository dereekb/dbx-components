import { compareStrings, unique } from '@dereekb/util';
import { type CliFirestoreQueryManifest, type CliFirestoreQueryManifestEntry } from '../manifest/types';

/**
 * A read API over the generated Firestore query catalog.
 *
 * Mirrors `ModelFirebaseIndexRegistry` (the build-time registry over the same tagged factories) so
 * the runtime catalog and the tooling catalog read the same way.
 */
export interface CliFirestoreQueryRegistry {
  readonly all: readonly CliFirestoreQueryManifestEntry[];
  readonly collections: readonly string[];
  readonly models: readonly string[];
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  /**
   * Resolves by slug first, then by exported identifier — both spellings are accepted on the
   * command line.
   */
  findBySlugOrName(query: string): CliFirestoreQueryManifestEntry | undefined;
  findByModel(model: string): readonly CliFirestoreQueryManifestEntry[];
  findByCollection(collection: string): readonly CliFirestoreQueryManifestEntry[];
  findByCategory(category: string): readonly CliFirestoreQueryManifestEntry[];
  findByTag(tag: string): readonly CliFirestoreQueryManifestEntry[];
}

/**
 * Builds a {@link CliFirestoreQueryRegistry} over a generated manifest.
 *
 * @param manifest - The generated `<NS>_FIRESTORE_QUERY_MANIFEST`.
 * @returns The read API.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCliFirestoreQueryRegistry(manifest: CliFirestoreQueryManifest): CliFirestoreQueryRegistry {
  const all = [...manifest].sort((a, b) => compareStrings(a.slug, b.slug));
  const bySlug = new Map(all.map((x) => [x.slug, x]));
  const byName = new Map(all.map((x) => [x.name, x]));

  return {
    all,
    collections: sortedUnique(all.map((x) => x.collection)),
    models: sortedUnique(all.map((x) => x.model)),
    categories: sortedUnique(all.flatMap((x) => (x.category ? [x.category] : []))),
    tags: sortedUnique(all.flatMap((x) => x.tags ?? [])),
    findBySlugOrName: (query) => bySlug.get(query) ?? byName.get(query),
    findByModel: (model) => all.filter((x) => x.model === model || x.collection === model),
    findByCollection: (collection) => all.filter((x) => x.collection === collection),
    findByCategory: (category) => all.filter((x) => x.category === category),
    findByTag: (tag) => {
      const lower = tag.toLowerCase();
      return all.filter((x) => (x.tags ?? []).some((t) => t.toLowerCase() === lower));
    }
  };
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return unique([...values]).sort(compareStrings);
}
