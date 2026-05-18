/**
 * @module Firestore Paged Item Accessor
 *
 * Internal read/write orchestration for {@link PagedItemFirestoreCollection}.
 * The accessor distributes a logical `T[]` across N page documents and a
 * single index document under a parent, then merges them back on read.
 *
 * The accessor goes lower-level than the standard
 * {@link FirestoreSingleDocumentAccessor}: it bypasses per-collection
 * converters because page documents (`PagedItemPageData<T>`) and the index
 * document (`PagedItemIndexData`) have different shapes that can't be
 * expressed by a single document converter.
 */
import { type Maybe, type Building, compareStringsNumeric } from '@dereekb/util';
import { type CollectionReference, type DocumentReference, type Transaction } from '../types';
import { type FirestoreAccessorDriver } from '../driver/accessor';
import { type FirestoreDocumentContext } from './context';
import { type FirestoreDocumentDataAccessor } from './accessor';
import { type FirestoreDocumentAccessorContextExtension } from './document';
import { type CollectionReferenceRef, type FirestoreContextReference } from '../reference';
import { type PagedItemConverter, type PagedItemDistributionScheme, type PagedItemIndexData, type PagedItemPageData } from '../collection/subcollection.paged';

// MARK: Accessor Interface
/**
 * Accessor for reading and writing paged item data.
 *
 * Replaces the per-page document accessor exposed on a standard
 * {@link FirestoreCollectionWithParent}. All methods orchestrate the
 * multi-document index/page layout internally.
 *
 * @template T - The item type stored across pages
 *
 * @example
 * ```ts
 * // Read all items (loads index, then all pages in parallel)
 * const allItems = await pagedCollection.loadAllItems();
 *
 * // Read specific pages (static mode — caller knows the scheme)
 * const cItems = await pagedCollection.loadItemsForPages(['c']);
 *
 * // Replace the full T[] (collection handles distribution)
 * await pagedCollection.writeAllItems(allItems);
 * ```
 */
export interface FirestorePagedItemAccessor<T> {
  /**
   * ID of the index document.
   */
  readonly indexDocumentId: string;
  /**
   * The static distribution scheme, if configured.
   */
  readonly distributionScheme: Maybe<PagedItemDistributionScheme<T>>;
  /**
   * True when a static distribution scheme is configured.
   */
  readonly isStaticDistribution: boolean;

  /**
   * Loads only the index document.
   *
   * Returns `undefined` when the paged collection has never been written
   * (the index document does not yet exist).
   */
  loadIndex(): Promise<Maybe<PagedItemIndexData>>;

  /**
   * Loads all pages and returns the merged `T[]`.
   *
   * Reads the index, then all listed pages in parallel, merging items in
   * page order. Returns an empty array when the collection has never been
   * written.
   */
  loadAllItems(): Promise<T[]>;

  /**
   * Loads items from specific page IDs only.
   *
   * In static mode this skips the index read — callers know which pages to
   * fetch from the distribution scheme. In dynamic mode the IDs are numeric
   * strings (`'0'`, `'1'`, ...) and callers should typically discover them
   * via {@link loadIndex} first.
   *
   * Pages that don't exist are silently skipped.
   *
   * @param pageIds - The page IDs to read
   */
  loadItemsForPages(pageIds: string[]): Promise<T[]>;

  /**
   * Replaces the full `T[]` contents of the paged collection.
   *
   * Distributes items into pages, writes/updates page documents, deletes
   * pages no longer needed, and updates the index — all in a single
   * WriteBatch.
   *
   * @param items - The full set of items to store
   */
  writeAllItems(items: T[]): Promise<void>;

  /**
   * Same as {@link writeAllItems} but participates in an existing transaction.
   *
   * The accessor reads existing pages within the transaction, computes the
   * new distribution, and writes all changes within the same transaction.
   *
   * Cost: N reads (current pages) + M writes (new pages + deletes + index).
   * For a typical 2–6 page collection this is well within Firestore's
   * transaction limits.
   *
   * @param transaction - Active Firestore transaction
   * @param items - The full set of items to store
   */
  writeAllItemsInTransaction(transaction: Transaction, items: T[]): Promise<void>;
}

// MARK: Configuration
/**
 * Configuration for {@link extendFirestoreCollectionWithPagedItemAccessor}.
 *
 * @template T - The item type stored across pages
 */
export interface PagedItemAccessorExtensionConfig<T> {
  readonly indexDocumentId: string;
  readonly distributionScheme: Maybe<PagedItemDistributionScheme<T>>;
  readonly maxItemsPerPage: number;
  readonly itemConverter: Maybe<PagedItemConverter<T>>;
  /**
   * Standard document accessor extension for the underlying collection.
   * Currently unused (page CRUD goes through the raw driver) but accepted
   * for parity with {@link extendFirestoreCollectionWithSingleDocumentAccessor}
   * and future use.
   */
  readonly accessors: FirestoreDocumentAccessorContextExtension<PagedItemPageData<T>>;
}

// MARK: Internal helpers
interface DistributeAndWritePagesInput<T> {
  readonly items: T[];
  readonly distributionScheme: Maybe<PagedItemDistributionScheme<T>>;
  readonly maxItemsPerPage: number;
  readonly itemConverter: Maybe<PagedItemConverter<T>>;
  readonly existingPageIds: string[];
  readonly collectionRef: CollectionReference<unknown>;
  readonly indexRef: DocumentReference<unknown>;
  readonly firestoreAccessorDriver: FirestoreAccessorDriver;
  readonly context: FirestoreDocumentContext<unknown>;
}

/**
 * Internal helper: distribute items into per-page buckets, write each page,
 * delete pages that no longer have items, and write the updated index.
 *
 * @param input - Distribution and write context.
 * @returns Resolves once every page write is queued onto the supplied context.
 */
function distributeAndWritePages<T>(input: DistributeAndWritePagesInput<T>): Promise<void> {
  const { items, distributionScheme, maxItemsPerPage, itemConverter, existingPageIds, collectionRef, indexRef, firestoreAccessorDriver, context } = input;

  const pageBuckets = new Map<string, T[]>();

  if (distributionScheme) {
    const allowed = new Set(distributionScheme.pageIds);
    for (const item of items) {
      const pageId = distributionScheme.distribute(item);

      if (!allowed.has(pageId)) {
        throw new Error(`PagedItemDistributionScheme.distribute() returned page id "${pageId}" which is not in the scheme's pageIds.`);
      }

      const bucket = pageBuckets.get(pageId);

      if (bucket) {
        bucket.push(item);
      } else {
        pageBuckets.set(pageId, [item]);
      }
    }
  } else {
    for (let i = 0; i < items.length; i += maxItemsPerPage) {
      const pageId = String(Math.floor(i / maxItemsPerPage));
      pageBuckets.set(pageId, items.slice(i, i + maxItemsPerPage));
    }
  }

  const newPageIds: string[] = [];
  const pageCounts: Record<string, number> = {};
  const writePromises: Promise<unknown>[] = [];

  for (const [pageId, pageItems] of pageBuckets) {
    if (pageItems.length === 0) {
      continue;
    }

    const convertedItems = itemConverter ? pageItems.map((item) => itemConverter.toData(item) as T) : pageItems;
    const pageData: PagedItemPageData<T> = {
      i: convertedItems,
      c: pageItems.length
    };
    const pageRef = firestoreAccessorDriver.doc<unknown>(collectionRef, pageId);
    const accessor = context.accessorFactory.accessorFor(pageRef);

    writePromises.push(accessor.set(pageData as unknown as object));
    newPageIds.push(pageId);
    pageCounts[pageId] = pageItems.length;
  }

  for (const oldPageId of existingPageIds) {
    if (!pageBuckets.has(oldPageId) || (pageBuckets.get(oldPageId)?.length ?? 0) === 0) {
      const oldPageRef = firestoreAccessorDriver.doc<unknown>(collectionRef, oldPageId);
      const accessor = context.accessorFactory.accessorFor(oldPageRef);
      writePromises.push(accessor.delete());
    }
  }

  newPageIds.sort(compareStringsNumeric);

  const indexData: PagedItemIndexData = {
    tc: items.length,
    p: newPageIds,
    pc: pageCounts,
    u: Date.now()
  };

  const indexAccessor = context.accessorFactory.accessorFor(indexRef);
  writePromises.push(indexAccessor.set(indexData as unknown as object));

  return Promise.all(writePromises).then(() => undefined);
}

interface ReadPageInput<T> {
  readonly pageId: string;
  readonly collectionRef: CollectionReference<unknown>;
  readonly firestoreAccessorDriver: FirestoreAccessorDriver;
  readonly context: FirestoreDocumentContext<unknown>;
  readonly itemConverter: Maybe<PagedItemConverter<T>>;
}

/**
 * Internal helper: read a single page and return its items.
 * Missing pages are silently treated as empty.
 *
 * @param input - Page-read context.
 * @returns The items present on the requested page, or an empty array if the page does not exist.
 */
async function readPageInto<T>(input: ReadPageInput<T>): Promise<T[]> {
  const { pageId, collectionRef, firestoreAccessorDriver, context, itemConverter } = input;
  const pageRef = firestoreAccessorDriver.doc<unknown>(collectionRef, pageId);
  const accessor: FirestoreDocumentDataAccessor<unknown> = context.accessorFactory.accessorFor(pageRef);
  const snapshot = await accessor.get();
  const data = snapshot.data() as Maybe<PagedItemPageData<T>>;
  let result: T[];

  if (data) {
    const items = data.i ?? [];
    result = itemConverter ? items.map((raw) => itemConverter.fromData(raw as object)) : items;
  } else {
    result = [];
  }

  return result;
}

// MARK: Extension
/**
 * Extends a Firestore collection object in-place with paged item accessor methods.
 *
 * The collection must already expose {@link CollectionReferenceRef} and
 * {@link FirestoreContextReference} from its base — both are provided by
 * {@link makeFirestoreCollectionWithParent}.
 *
 * @param x - The collection object to extend.
 * @param config - Paged accessor configuration.
 */
export function extendFirestoreCollectionWithPagedItemAccessor<X extends FirestorePagedItemAccessor<T> & CollectionReferenceRef<unknown> & FirestoreContextReference, T>(x: Building<X>, config: PagedItemAccessorExtensionConfig<T>): void {
  const { indexDocumentId, distributionScheme, maxItemsPerPage, itemConverter } = config;
  // Strip any consumer-supplied converter from the underlying collection: page documents
  // ({@link PagedItemPageData}) and the index document ({@link PagedItemIndexData}) have
  // internal envelope shapes that don't match the consumer's T converter. Operating on the
  // raw collection avoids losing fields when reading/writing.
  const collectionRef = (x as CollectionReferenceRef<unknown>).collection.withConverter(null) as unknown as CollectionReference<unknown>;
  const firestoreContext = (x as unknown as FirestoreContextReference).firestoreContext;
  const firestoreAccessorDriver = firestoreContext.drivers.firestoreAccessorDriver;

  const indexRef: DocumentReference<unknown> = firestoreAccessorDriver.doc<unknown>(collectionRef, indexDocumentId);

  async function loadIndex(): Promise<Maybe<PagedItemIndexData>> {
    const context = firestoreAccessorDriver.defaultContextFactory<unknown>();
    const accessor = context.accessorFactory.accessorFor(indexRef);
    const snapshot = await accessor.get();
    return snapshot.data() as Maybe<PagedItemIndexData>;
  }

  async function loadItemsForPagesWithContext(pageIds: string[], context: FirestoreDocumentContext<unknown>): Promise<T[]> {
    let result: T[];

    if (pageIds.length === 0) {
      result = [];
    } else {
      const pageReads = pageIds.map((pageId) =>
        readPageInto<T>({
          pageId,
          collectionRef,
          firestoreAccessorDriver,
          context,
          itemConverter
        })
      );

      const pageResults = await Promise.all(pageReads);
      result = pageResults.flat();
    }

    return result;
  }

  async function loadAllItems(): Promise<T[]> {
    const index = await loadIndex();
    let result: T[];

    if (index) {
      const context = firestoreAccessorDriver.defaultContextFactory<unknown>();
      result = await loadItemsForPagesWithContext(index.p, context);
    } else {
      result = [];
    }

    return result;
  }

  async function loadItemsForPages(pageIds: string[]): Promise<T[]> {
    const context = firestoreAccessorDriver.defaultContextFactory<unknown>();
    return loadItemsForPagesWithContext(pageIds, context);
  }

  async function readExistingPageIds(readContext: FirestoreDocumentContext<unknown>): Promise<string[]> {
    const indexAccessor = readContext.accessorFactory.accessorFor(indexRef);
    const indexSnapshot = await indexAccessor.get();
    const indexData = indexSnapshot.data() as Maybe<PagedItemIndexData>;
    return indexData?.p ?? [];
  }

  async function writeAllItems(items: T[]): Promise<void> {
    const readContext = firestoreAccessorDriver.defaultContextFactory<unknown>();
    const existingPageIds = await readExistingPageIds(readContext);

    const writeBatch = firestoreContext.batch();
    const batchContext = firestoreAccessorDriver.writeBatchContextFactory<unknown>(writeBatch);

    await distributeAndWritePages<T>({
      items,
      distributionScheme,
      maxItemsPerPage,
      itemConverter,
      existingPageIds,
      collectionRef,
      indexRef,
      firestoreAccessorDriver,
      context: batchContext
    });

    await writeBatch.commit();
  }

  async function writeAllItemsInTransaction(transaction: Transaction, items: T[]): Promise<void> {
    const txContext = firestoreAccessorDriver.transactionContextFactory<unknown>(transaction);
    const existingPageIds = await readExistingPageIds(txContext);

    await distributeAndWritePages<T>({
      items,
      distributionScheme,
      maxItemsPerPage,
      itemConverter,
      existingPageIds,
      collectionRef,
      indexRef,
      firestoreAccessorDriver,
      context: txContext
    });
  }

  x.indexDocumentId = indexDocumentId;
  x.distributionScheme = distributionScheme;
  x.isStaticDistribution = distributionScheme != null;
  x.loadIndex = loadIndex;
  x.loadAllItems = loadAllItems;
  x.loadItemsForPages = loadItemsForPages;
  x.writeAllItems = writeAllItems;
  x.writeAllItemsInTransaction = writeAllItemsInTransaction;
}
