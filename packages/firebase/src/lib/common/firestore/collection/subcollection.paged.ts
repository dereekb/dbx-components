/**
 * @module Firestore Paged Item Subcollections
 *
 * Provides a subcollection variant that distributes a logical `T[]` across
 * multiple page documents under a parent. Sibling to
 * {@link SingleItemFirestoreCollection} (one document per parent) and
 * {@link FirestoreCollectionWithParent} (multi-item subcollection).
 *
 * Use a paged subcollection when index-like data exceeds Firestore's 1MB
 * single-document cap but is still small enough to fit comfortably in a
 * handful of documents (rule of thumb: <= 6 pages). For larger payloads,
 * a JSON blob in Cloud Storage is usually a better fit.
 *
 * Two distribution modes:
 * - **Static (scheme-based)**: each item maps deterministically to a page ID
 *   via {@link PagedItemDistributionScheme}. Enables targeted reads of a
 *   specific page without consulting the index.
 * - **Dynamic (count-based)**: the collection splits items by
 *   {@link DEFAULT_PAGED_ITEM_MAX_ITEMS_PER_PAGE} per page; page IDs are
 *   sequential numeric strings (`'0'`, `'1'`, ...).
 *
 * Reads return the merged `T[]`. Writes always replace the full `T[]` —
 * partial updates are not supported because re-distributing items between
 * pages would violate the all-or-nothing layout invariant.
 */
import { build } from '@dereekb/util';
import { extendFirestoreCollectionWithPagedItemAccessor, type FirestorePagedItemAccessor } from '../accessor/document.paged';
import { type FirestoreDocument, type FirestoreDocumentAccessorContextExtension } from '../accessor/document';
import { type FirestoreCollectionWithParent, type FirestoreCollectionWithParentConfig, makeFirestoreCollectionWithParent } from './subcollection';
import { snapshotConverterFunctions } from '../snapshot/snapshot';
import { type SnapshotConverterFunctions } from '../snapshot/snapshot.type';
import { firestoreNumber, firestorePassThroughField } from '../snapshot/snapshot.field';

// MARK: Constants
/**
 * Default ID for the index document inside a paged subcollection.
 *
 * The underscore prefix visually distinguishes the index from page documents
 * and sorts before numeric/alphabetic page IDs.
 */
export const DEFAULT_PAGED_ITEM_INDEX_DOCUMENT_ID = '_index';

/**
 * Default maximum number of items per page document when using dynamic
 * (count-based) distribution.
 */
export const DEFAULT_PAGED_ITEM_MAX_ITEMS_PER_PAGE = 500;

// MARK: Types
/**
 * Defines how items are distributed across page documents.
 *
 * The scheme must be deterministic — for any item, {@link distribute} always
 * returns the same page ID. This determinism is what enables selective reads
 * in static mode: callers can read a specific page directly without first
 * consulting the index document.
 *
 * @template T - The item type stored in the paged collection
 *
 * @example
 * ```ts
 * // Alphabetic distribution: items bucketed by first letter
 * const alphaScheme: PagedItemDistributionScheme<NameEntry> = {
 *   pageIds: 'abcdefghijklmnopqrstuvwxyz'.split(''),
 *   distribute: (entry) => entry.name[0]?.toLowerCase() ?? 'a'
 * };
 * ```
 */
export interface PagedItemDistributionScheme<T> {
  /**
   * All possible page IDs in this scheme, in deterministic order.
   *
   * Defines the full set of page documents that may exist. Empty pages are
   * not written, so this is the universe of allowed IDs, not necessarily
   * the set of pages currently present.
   */
  readonly pageIds: readonly string[];
  /**
   * Maps an item to its target page ID.
   *
   * Must return a value that exists in {@link pageIds}. If it returns an
   * unknown ID, the write throws.
   */
  readonly distribute: (item: T) => string;
}

/**
 * Ref to a {@link PagedItemDistributionScheme}.
 */
export interface PagedItemDistributionSchemeRef<T> {
  readonly distributionScheme: PagedItemDistributionScheme<T>;
}

/**
 * Converts individual items to/from their Firestore POJO representation.
 *
 * Distinct from a {@link FirestoreDataConverter}: this operates on individual
 * items inside a page's items array, not on whole DocumentSnapshots. The
 * collection wraps these per-item conversions inside the paged page envelope
 * (`{ i, c }`) automatically.
 *
 * @template T - The item type the consumer sees in memory
 */
export interface PagedItemConverter<T> {
  /**
   * Convert from a Firestore POJO to in-memory T.
   */
  readonly fromData: (data: object) => T;
  /**
   * Convert from in-memory T to a Firestore-safe POJO.
   */
  readonly toData: (item: T) => object;
}

/**
 * Data stored in the index document of a paged subcollection.
 *
 * Field names are short to keep the index document small; this is internal
 * framework data, not developer-facing state.
 */
export interface PagedItemIndexData {
  /**
   * Total item count across all pages.
   */
  readonly tc: number;
  /**
   * Page IDs that currently contain at least one item, in insertion order.
   *
   * For dynamic mode: `['0', '1', '2', ...]`.
   * For static mode: a subset of the scheme's `pageIds` (only pages with items).
   */
  readonly p: string[];
  /**
   * Per-page item counts, keyed by page ID. Lets consumers know how many
   * items are on each page without reading the page document itself.
   */
  readonly pc: Record<string, number>;
  /**
   * Timestamp (ms) of the last write operation. Useful for staleness checks.
   */
  readonly u: number;
}

/**
 * Data stored in each page document of a paged subcollection.
 *
 * The {@link i} array contains the actual `T[]` slice. The `c` field is a
 * denormalized count, available without deserializing `i`.
 *
 * @template T - The item type stored in the paged collection
 */
export interface PagedItemPageData<T> {
  /**
   * Items on this page. Each item is converted via {@link PagedItemConverter}.
   */
  readonly i: T[];
  /**
   * Item count on this page (denormalized).
   */
  readonly c: number;
}

// MARK: Configuration
/**
 * Configuration for creating a {@link PagedItemFirestoreCollection}.
 *
 * Extends {@link FirestoreCollectionWithParentConfig} for parent/identity/context.
 * The page-document data type is the {@link PagedItemPageData} envelope so the
 * standard accessor returns the actual stored shape (mirroring the
 * {@link SystemState}/{@link SystemStateDocument} pattern). The paged accessor
 * methods bypass the converter and operate on the raw collection so the index
 * document — which has a different shape — is read/written correctly.
 *
 * The {@link converter} field is optional: when omitted, the collection uses
 * {@link defaultPagedItemPageDataConverter}, a pass-through converter for the
 * envelope. Provide a custom converter only when you need per-field handling on
 * the page document.
 *
 * @template T - The item type stored across page documents
 * @template PT - The parent document data type
 * @template D - The page document type (data shape: {@link PagedItemPageData}<T>)
 * @template PD - The parent document type
 */
export interface PagedItemFirestoreCollectionConfig<T, PT, D extends FirestoreDocument<PagedItemPageData<T>> = FirestoreDocument<PagedItemPageData<T>>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends Omit<FirestoreCollectionWithParentConfig<PagedItemPageData<T>, PT, D, PD>, 'converter'> {
  /**
   * Optional snapshot converter for the page document envelope. Defaults to
   * {@link defaultPagedItemPageDataConverter} when omitted.
   */
  readonly converter?: FirestoreCollectionWithParentConfig<PagedItemPageData<T>, PT, D, PD>['converter'];
  /**
   * ID of the index document. Defaults to {@link DEFAULT_PAGED_ITEM_INDEX_DOCUMENT_ID}.
   */
  readonly indexDocumentId?: string;
  /**
   * Static distribution scheme. When provided, the collection uses
   * scheme-based static distribution. When omitted, the collection uses
   * dynamic count-based paging.
   */
  readonly distributionScheme?: PagedItemDistributionScheme<T>;
  /**
   * Max items per page document. Only used in dynamic mode. Defaults to
   * {@link DEFAULT_PAGED_ITEM_MAX_ITEMS_PER_PAGE}.
   */
  readonly maxItemsPerPage?: number;
  /**
   * Per-item converter applied to individual `T`s when reading/writing the
   * `i` array of a page document. If omitted, items are stored as-is and
   * must already be Firestore-safe POJOs.
   */
  readonly itemConverter?: PagedItemConverter<T>;
}

/**
 * A subcollection that stores a logical `T[]` distributed across multiple
 * page documents under a parent.
 *
 * Combines {@link FirestoreCollectionWithParent} (for parent/context/identity)
 * with {@link FirestorePagedItemAccessor} (for paged read/write operations).
 *
 * The standard document accessor methods inherited from
 * {@link FirestoreCollectionWithParent} return the raw {@link PagedItemPageData}
 * envelope. In normal usage callers should use the paged accessor methods
 * (e.g. {@link FirestorePagedItemAccessor.loadAllItems}) which apply the
 * configured {@link PagedItemConverter} per item.
 *
 * @template T - The item type stored across pages
 * @template PT - The parent document data type
 * @template D - The page document type (data shape: {@link PagedItemPageData}<T>)
 * @template PD - The parent document type
 */
export interface PagedItemFirestoreCollection<T, PT, D extends FirestoreDocument<PagedItemPageData<T>> = FirestoreDocument<PagedItemPageData<T>>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends FirestoreCollectionWithParent<PagedItemPageData<T>, PT, D, PD>, FirestorePagedItemAccessor<T> {}

/**
 * Builds the default snapshot converter used by {@link PagedItemFirestoreCollection}
 * when no consumer-supplied converter is provided.
 *
 * The page envelope is the framework's internal storage shape: `i` is the array of
 * raw entries (already Firestore-safe at this level — per-entry conversion is
 * handled by the paged accessor's {@link PagedItemConverter}) and `c` is the
 * denormalized count.
 *
 * @returns A snapshot converter for {@link PagedItemPageData}<T>.
 *
 * @template T - The item type stored across pages
 *
 * @__NO_SIDE_EFFECTS__
 */
export function defaultPagedItemPageDataConverter<T>(): SnapshotConverterFunctions<PagedItemPageData<T>> {
  return snapshotConverterFunctions<PagedItemPageData<T>>({
    fields: {
      i: firestorePassThroughField<T[]>(),
      c: firestoreNumber({ default: 0, defaultBeforeSave: 0 })
    }
  });
}

/**
 * Creates a {@link PagedItemFirestoreCollection}.
 *
 * Mirrors the `build()` + extend pattern used by
 * {@link makeSingleItemFirestoreCollection}: the base
 * {@link FirestoreCollectionWithParent} provides parent/identity/context, and
 * {@link extendFirestoreCollectionWithPagedItemAccessor} attaches the paged
 * read/write methods. When the config does not supply a `converter`, the
 * default {@link defaultPagedItemPageDataConverter} is used so consumers don't
 * have to model the envelope shape themselves.
 *
 * @param config - Paged collection configuration.
 * @returns A configured paged subcollection.
 *
 * @template T - The item type stored across pages
 * @template PT - The parent document data type
 * @template D - The page document type
 * @template PD - The parent document type
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makePagedItemFirestoreCollection<T, PT, D extends FirestoreDocument<PagedItemPageData<T>> = FirestoreDocument<PagedItemPageData<T>>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>(config: PagedItemFirestoreCollectionConfig<T, PT, D, PD>): PagedItemFirestoreCollection<T, PT, D, PD> {
  const resolvedConverter = config.converter ?? defaultPagedItemPageDataConverter<T>();
  const baseConfig = { ...config, converter: resolvedConverter } as FirestoreCollectionWithParentConfig<PagedItemPageData<T>, PT, D, PD>;

  return build<PagedItemFirestoreCollection<T, PT, D, PD>>({
    base: makeFirestoreCollectionWithParent(baseConfig),
    build: (x) => {
      extendFirestoreCollectionWithPagedItemAccessor<PagedItemFirestoreCollection<T, PT, D, PD>, T>(x, {
        indexDocumentId: config.indexDocumentId ?? DEFAULT_PAGED_ITEM_INDEX_DOCUMENT_ID,
        distributionScheme: config.distributionScheme,
        maxItemsPerPage: config.maxItemsPerPage ?? DEFAULT_PAGED_ITEM_MAX_ITEMS_PER_PAGE,
        itemConverter: config.itemConverter,
        accessors: x as unknown as FirestoreDocumentAccessorContextExtension<PagedItemPageData<T>>
      });
    }
  });
}
