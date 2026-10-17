import {
  buildRankedSearchEntries,
  buildRankedSearchSynonyms,
  firstSentence,
  jsDocInlineLinksToText,
  rankSearchEntries,
  RANKED_SEARCH_ENGLISH_STOP_WORDS,
  RANKED_SEARCH_NAME_WEIGHTS,
  RANKED_SEARCH_SLUG_WEIGHTS,
  RANKED_SEARCH_TAG_WEIGHTS,
  RANKED_SEARCH_TEXT_WEIGHTS,
  type Maybe,
  type RankedSearchEntry,
  type RankedSearchMatchMode,
  type RankedSearchSynonyms
} from '@dereekb/util';
import { flattenModelManifestFields, type FlatModelManifestField, type ModelManifest, type ModelManifestEntry } from './model.manifest';
import { type ModelManifestEnum, type ModelManifestEnums } from './model.manifest.enum';
import { buildModelManifestEnumUsageIndex, type ModelManifestEnumUsageIndex } from './model.manifest.usage';

// MARK: Constants
/**
 * Default number of hits {@link searchModelManifestCatalog} returns.
 */
export const DEFAULT_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT = 10;

/**
 * Maximum number of hits {@link searchModelManifestCatalog} returns per page.
 */
export const MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT = 50;

/**
 * Maximum length of a hit's one-line `summary`.
 */
export const MODEL_MANIFEST_CATALOG_SUMMARY_MAX_LENGTH = 240;

/**
 * Words that also match each other in a catalog search: model docs say "state" and "status"
 * interchangeably.
 */
export const MODEL_MANIFEST_CATALOG_SEARCH_SYNONYMS: RankedSearchSynonyms = buildRankedSearchSynonyms([['state', 'status']]);

// MARK: Hits
/**
 * Kind of a catalog search hit.
 */
export type ModelManifestCatalogHitKind = 'model' | 'field' | 'enum';

/**
 * All catalog hit kinds, in index order.
 */
export const MODEL_MANIFEST_CATALOG_HIT_KINDS: readonly ModelManifestCatalogHitKind[] = ['model', 'field', 'enum'];

/**
 * A model hit. Pass `modelType` back as a `model` lookup.
 */
export interface ModelManifestCatalogModelHit {
  readonly kind: 'model';
  readonly modelType: string;
  readonly modelName: string;
  readonly collectionPrefix: string;
  readonly modelGroup?: string;
  readonly summary?: string;
}

/**
 * A stored-field hit. Pass `modelType` back as a `model` lookup, or `enumRef` as an `enum` lookup.
 */
export interface ModelManifestCatalogFieldHit {
  readonly kind: 'field';
  readonly modelType: string;
  /**
   * Dotted path of persisted short keys from the model root (e.g. `r.s`).
   */
  readonly field: string;
  /**
   * Dotted path of long names from the model root (e.g. `resume.state`).
   */
  readonly longName: string;
  readonly tsType?: string;
  readonly enumRef?: string;
  readonly summary?: string;
}

/**
 * An enum hit. Pass `enum` back as an `enum` lookup.
 */
export interface ModelManifestCatalogEnumHit {
  readonly kind: 'enum';
  readonly enum: string;
  readonly valueCount: number;
  readonly summary?: string;
}

/**
 * One line of a catalog search result.
 */
export type ModelManifestCatalogHit = ModelManifestCatalogModelHit | ModelManifestCatalogFieldHit | ModelManifestCatalogEnumHit;

// MARK: Catalog
/**
 * The searchable model catalog, built once by {@link buildModelManifestCatalog}.
 */
export interface ModelManifestCatalog {
  readonly models: ModelManifest;
  readonly enums: ModelManifestEnums;
  /**
   * The enum names, sorted.
   */
  readonly enumNames: readonly string[];
  readonly enumUsage: ModelManifestEnumUsageIndex;
  /**
   * The pre-tokenized search entries: models in manifest order, then enums by name, then fields.
   */
  readonly entries: readonly RankedSearchEntry<ModelManifestCatalogHit>[];
  /**
   * Lowercased exact names of each hit (model type / name / identity const / collection prefix, or
   * enum name). A query equal to one of these always ranks that hit first.
   */
  readonly exactNames: ReadonlyMap<ModelManifestCatalogHit, readonly string[]>;
}

/**
 * Input to {@link buildModelManifestCatalog}.
 */
export interface BuildModelManifestCatalogInput {
  readonly models?: Maybe<ModelManifest>;
  readonly enums?: Maybe<ModelManifestEnums>;
}

/**
 * Builds the searchable catalog over a model manifest and its enum tables: the enum usage index and
 * the pre-tokenized search entries. Build it once (at boot, or lazily) and reuse it per query.
 *
 * @param input - The model manifest and enum tables.
 * @returns The catalog.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildModelManifestCatalog(input: BuildModelManifestCatalogInput): ModelManifestCatalog {
  const models = input.models ?? [];
  const enums = input.enums ?? {};
  const enumNames = Object.keys(enums).sort((a, b) => a.localeCompare(b));
  const enumUsage = buildModelManifestEnumUsageIndex(models);
  const exactNames = new Map<ModelManifestCatalogHit, readonly string[]>();

  const modelItems = models.map((entry) => {
    const hit = toModelHit(entry);
    exactNames.set(
      hit,
      [entry.modelType, entry.modelName, entry.identityConst, entry.collectionPrefix].map((x) => x.toLowerCase())
    );
    return { hit, entry };
  });

  const enumItems = enumNames.map((name) => {
    const table = enums[name];
    const hit = toEnumHit(table);
    exactNames.set(hit, [name.toLowerCase()]);
    return { hit, table };
  });

  const fieldItems = models.flatMap((entry) => flattenModelManifestFields(entry.fields).map((flat) => ({ hit: toFieldHit(entry, flat), entry, flat })));

  const entries: RankedSearchEntry<ModelManifestCatalogHit>[] = [
    ...buildRankedSearchEntries(modelItems, [
      { read: (x) => [x.entry.modelType, x.entry.modelName, x.entry.identityConst, x.entry.collectionPrefix], weights: RANKED_SEARCH_NAME_WEIGHTS },
      { read: (x) => x.entry.modelGroup, weights: RANKED_SEARCH_TAG_WEIGHTS },
      { read: (x) => x.entry.description, weights: RANKED_SEARCH_TEXT_WEIGHTS }
    ]).map(toHitEntry),
    ...buildRankedSearchEntries(enumItems, [
      { read: (x) => x.table.name, weights: RANKED_SEARCH_NAME_WEIGHTS },
      { read: (x) => x.table.values.map((v) => v.name), weights: RANKED_SEARCH_SLUG_WEIGHTS },
      { read: (x) => [x.table.description, ...x.table.values.flatMap((v) => [v.description, String(v.value)])], weights: RANKED_SEARCH_TEXT_WEIGHTS }
    ]).map(toHitEntry),
    ...buildRankedSearchEntries(fieldItems, [
      { read: (x) => x.flat.field.longName, weights: RANKED_SEARCH_NAME_WEIGHTS },
      { read: (x) => [x.flat.field.name, x.flat.path, x.flat.longPath], weights: RANKED_SEARCH_SLUG_WEIGHTS },
      { read: (x) => [x.flat.field.enumRef, x.flat.field.tsType], weights: RANKED_SEARCH_TAG_WEIGHTS },
      { read: (x) => [x.entry.modelType, x.entry.modelName, x.flat.field.description], weights: RANKED_SEARCH_TEXT_WEIGHTS }
    ]).map(toHitEntry)
  ];

  return { models, enums, enumNames, enumUsage, entries, exactNames };
}

// MARK: Search
/**
 * Input to {@link searchModelManifestCatalog}.
 */
export interface SearchModelManifestCatalogInput {
  readonly catalog: ModelManifestCatalog;
  readonly query?: Maybe<string>;
  /**
   * Restricts hits to one kind. With an empty query, lists every entry of that kind in catalog order.
   */
  readonly kind?: Maybe<ModelManifestCatalogHitKind>;
  /**
   * Defaults to {@link DEFAULT_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT}; clamped to 1..{@link MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT}.
   */
  readonly limit?: Maybe<number>;
  /**
   * Number of ranked hits to skip, for paging. Floored; negative or non-numeric values count as 0.
   */
  readonly offset?: Maybe<number>;
  /**
   * Defaults to `all`, which falls back to `any` (with `partial: true`) when no entry matches every query word.
   */
  readonly mode?: Maybe<RankedSearchMatchMode>;
}

/**
 * Result of {@link searchModelManifestCatalog}.
 */
export interface SearchModelManifestCatalogResult {
  readonly hits: readonly ModelManifestCatalogHit[];
  /**
   * Total hits before the offset and limit were applied.
   */
  readonly total: number;
  /**
   * The offset that was applied.
   */
  readonly offset: number;
  /**
   * True when no entry matched every query word, so {@link hits} match only some of them.
   */
  readonly partial: boolean;
}

/**
 * Searches the catalog's models, fields, and enums by keyword.
 *
 * English filler words are dropped and `state` / `status` match each other. A query equal to a
 * model's type, name, identity const, or collection prefix — or to an enum name — always ranks that
 * entry first; otherwise ties keep catalog order (models, then enums, then fields). An empty query
 * returns nothing unless `kind` narrows it.
 *
 * @param input - The catalog, query, kind filter, and page.
 * @returns The page of hits, the total, the applied offset, and whether the hits are partial.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function searchModelManifestCatalog(input: SearchModelManifestCatalogInput): SearchModelManifestCatalogResult {
  const { catalog, kind } = input;
  const query = input.query?.trim() ?? '';
  const mode = input.mode ?? 'all';
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? DEFAULT_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT)), MAX_MODEL_MANIFEST_CATALOG_SEARCH_LIMIT);
  const offset = typeof input.offset === 'number' && Number.isFinite(input.offset) ? Math.max(0, Math.floor(input.offset)) : 0;
  const filter = kind == null ? undefined : (hit: ModelManifestCatalogHit) => hit.kind === kind;
  let matches: ModelManifestCatalogHit[];
  let partial = false;

  if (query.length === 0) {
    matches = filter == null ? [] : catalog.entries.map((x) => x.value).filter(filter);
  } else {
    const rankInput = { entries: catalog.entries, query, filter, stopWords: RANKED_SEARCH_ENGLISH_STOP_WORDS, synonyms: MODEL_MANIFEST_CATALOG_SEARCH_SYNONYMS };
    matches = rankSearchEntries({ ...rankInput, mode }).map((x) => x.value);

    if (matches.length === 0 && mode === 'all') {
      matches = rankSearchEntries({ ...rankInput, mode: 'any' }).map((x) => x.value);
      partial = matches.length > 0;
    }

    const lowerQuery = query.toLowerCase();
    const isExact = (hit: ModelManifestCatalogHit) => catalog.exactNames.get(hit)?.includes(lowerQuery) === true;
    matches = [...matches.filter(isExact), ...matches.filter((hit) => !isExact(hit))];
  }

  return { hits: matches.slice(offset, offset + limit), total: matches.length, offset, partial };
}

// MARK: Internal
function toHitEntry<T extends { readonly hit: ModelManifestCatalogHit }>(entry: RankedSearchEntry<T>): RankedSearchEntry<ModelManifestCatalogHit> {
  return { value: entry.value.hit, fields: entry.fields };
}

function toSummary(description: Maybe<string>): Maybe<string> {
  const summary = description ? firstSentence(jsDocInlineLinksToText(description), { maxLength: MODEL_MANIFEST_CATALOG_SUMMARY_MAX_LENGTH }) : undefined;
  return summary ? summary : undefined;
}

function toModelHit(entry: ModelManifestEntry): ModelManifestCatalogModelHit {
  const summary = toSummary(entry.description);

  return {
    kind: 'model',
    modelType: entry.modelType,
    modelName: entry.modelName,
    collectionPrefix: entry.collectionPrefix,
    ...(entry.modelGroup == null ? {} : { modelGroup: entry.modelGroup }),
    ...(summary == null ? {} : { summary })
  };
}

function toFieldHit(entry: ModelManifestEntry, flat: FlatModelManifestField): ModelManifestCatalogFieldHit {
  const { field } = flat;
  const summary = toSummary(field.description);

  return {
    kind: 'field',
    modelType: entry.modelType,
    field: flat.path,
    longName: flat.longPath,
    ...(field.tsType == null ? {} : { tsType: field.tsType }),
    ...(field.enumRef == null ? {} : { enumRef: field.enumRef }),
    ...(summary == null ? {} : { summary })
  };
}

function toEnumHit(table: ModelManifestEnum): ModelManifestCatalogEnumHit {
  const summary = toSummary(table.description);

  return {
    kind: 'enum',
    enum: table.name,
    valueCount: table.values.length,
    ...(summary == null ? {} : { summary })
  };
}
