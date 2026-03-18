import { type AsyncGetterOrValue, type Maybe, performMakeLoop, type UseAsync, wrapUseAsyncFunction, useAsync, makeWithFactory, filterMaybeArrayValues, runAsyncTasksForValues, type Building } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelIdRef, type FirestoreModelKey, type FirestoreModelKeyRef } from '../collection';
import { type QueryDocumentSnapshot, type DocumentDataWithIdAndKey, type DocumentReference, type DocumentSnapshot, type QuerySnapshot, type Transaction } from '../types';
import { type FirestoreDocumentData, type FirestoreDocument, type FirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessorContextExtension } from './document';

/**
 * Creates an array of new {@link FirestoreDocument} instances without persisting them to Firestore.
 *
 * Each document is allocated a unique auto-generated ID via {@link FirestoreDocumentAccessor.newDocument},
 * but no data is written to the database. Useful for preparing document references in bulk before
 * deciding what data to write.
 *
 * @param documentAccessor - Accessor that provides the `newDocument()` factory method
 * @param count - Number of document instances to create
 * @returns Array of `count` new document instances, each with a unique auto-generated ID
 */
export function newDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, count: number): D[] {
  return makeWithFactory(() => documentAccessor.newDocument(), count);
}

/**
 * Configuration for {@link makeDocuments} that controls how documents are created and initialized.
 */
export interface MakeDocumentsParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * Number of documents to create.
   */
  readonly count: number;

  /**
   * Optional factory override for creating new document instances.
   *
   * When omitted, the accessor's default {@link FirestoreDocumentAccessor.newDocument} is used,
   * which generates a random document ID. Provide this to customize document creation,
   * e.g. to use specific IDs via `loadDocumentForId`.
   *
   * @param documentAccessor - The accessor to create the document from
   * @returns A new document instance
   */
  readonly newDocument?: (documentAccessor: FirestoreDocumentAccessor<T, D>) => D;

  /**
   * Called for each document to produce its initial data.
   *
   * If the returned value is non-nullish, the document is created in Firestore with that data
   * via `document.accessor.create(data)`. If nullish, the document instance is still returned
   * but nothing is written to the database.
   *
   * @param i - Zero-based index of the current document
   * @param document - The document instance (already has an allocated reference)
   * @returns Data to persist, or nullish to skip Firestore creation
   */
  readonly init: (i: number, document: D) => Maybe<T> | Promise<Maybe<T>>;
}

/**
 * Creates and optionally persists multiple Firestore documents in sequence.
 *
 * Uses {@link performMakeLoop} to iterate `count` times. For each iteration:
 * 1. A new document instance is created (via `make.newDocument` or the default factory)
 * 2. `make.init(i, document)` is awaited to produce initial data
 * 3. If init returns non-nullish data, `document.accessor.create(data)` persists it
 * 4. The document instance is collected regardless of whether it was persisted
 *
 * Documents are created sequentially (not in parallel) to allow index-dependent logic.
 *
 * @param documentAccessor - Accessor providing the document factory and collection context
 * @param make - Configuration controlling count, factory, and initialization
 * @returns Promise resolving to all created document instances (length === `make.count`)
 */
export function makeDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, make: MakeDocumentsParams<T, D>): Promise<D[]> {
  const newDocumentFn = make.newDocument ?? (() => documentAccessor.newDocument());

  return performMakeLoop({
    count: make.count,
    make: async (i: number) => {
      const document: D = newDocumentFn(documentAccessor);
      const data = await make.init(i, document);

      if (data != null) {
        await document.accessor.create(data);
      }

      return document;
    }
  });
}

/**
 * Fetches {@link DocumentSnapshot}s for multiple documents in parallel using {@link runAsyncTasksForValues}.
 *
 * Each document's `accessor.get()` is called concurrently. The returned array preserves
 * the same ordering as the input `documents` array.
 *
 * @param documents - Documents to fetch snapshots for
 * @returns Snapshots in the same order as the input array
 */
export function getDocumentSnapshots<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return runAsyncTasksForValues(documents, (x) => x.accessor.get());
}

/**
 * Pairs a {@link FirestoreDocument} instance with its fetched {@link DocumentSnapshot}.
 *
 * Retains a reference to the original document alongside its snapshot, which is useful
 * when you need both the document's methods (e.g. `update`, `create`) and its current data state.
 */
export type FirestoreDocumentSnapshotPair<D extends FirestoreDocument<any>> = {
  /** The document instance used to fetch the snapshot. */
  readonly document: D;
  /** The fetched snapshot reflecting the document's current state in Firestore. */
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
};

/**
 * Fetches the current snapshot of a single document and pairs it with the document instance.
 *
 * @param document - The document to fetch
 * @returns A pair containing the document and its snapshot
 */
export function getDocumentSnapshotPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot }));
}

/**
 * Fetches snapshots for multiple documents in parallel and pairs each with its document instance.
 *
 * @param documents - Documents to fetch
 * @returns Pairs in the same order as the input array
 */
export function getDocumentSnapshotPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotPair);
}

/**
 * Combines a {@link FirestoreDocument}, its {@link DocumentSnapshot}, and extracted data with `id`/`key` fields.
 *
 * The `data` field is produced by {@link documentDataWithIdAndKey}, which mutates the snapshot's data object
 * to include `id` (the document ID) and `key` (the full document path). If the document does not exist
 * in Firestore, `data` will be `undefined`.
 */
export interface FirestoreDocumentSnapshotDataPair<D extends FirestoreDocument<any>> {
  /** The document instance used to fetch the snapshot. */
  readonly document: D;
  /** The fetched snapshot reflecting the document's current state in Firestore. */
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
  /** The snapshot's data with `id` and `key` fields injected, or `undefined` if the document does not exist. */
  readonly data: Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>;
}

/**
 * Narrowed variant of {@link FirestoreDocumentSnapshotDataPair} where `data` is guaranteed non-nullish.
 *
 * Used by functions like {@link getDocumentSnapshotDataPairsWithData} that filter out non-existent documents.
 */
export interface FirestoreDocumentSnapshotDataPairWithData<D extends FirestoreDocument<any>> extends Omit<FirestoreDocumentSnapshotDataPair<D>, 'data'> {
  /** The snapshot's data with `id` and `key` fields injected (guaranteed to exist). */
  readonly data: DocumentDataWithIdAndKey<FirestoreDocumentData<D>>;
}

/**
 * Fetches a document's snapshot, extracts its data with `id`/`key` fields, and returns all three as a triplet.
 *
 * @param document - The document to fetch
 * @returns A triplet of document, snapshot, and data (data may be `undefined` if the document doesn't exist)
 */
export function getDocumentSnapshotDataPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotDataPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot, data: documentDataWithIdAndKey(snapshot) }));
}

/**
 * Fetches snapshot-data triplets for multiple documents in parallel.
 *
 * Processes up to 200 documents concurrently via {@link runAsyncTasksForValues}.
 * The returned array preserves the same ordering as the input.
 *
 * @param documents - Documents to fetch
 * @returns Triplets in the same order as the input array
 */
export function getDocumentSnapshotDataPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotDataPair, {
    maxParallelTasks: 200 // load up to 200 documents at a time in parallel
  });
}

/**
 * Fetches snapshot-data triplets for multiple documents and filters out those that don't exist in Firestore.
 *
 * Convenience wrapper around {@link getDocumentSnapshotDataPairs} that removes entries where `data` is nullish,
 * returning only {@link FirestoreDocumentSnapshotDataPairWithData} results.
 *
 * @param documents - Documents to fetch
 * @returns Triplets for documents that exist, in their original relative order
 */
export function getDocumentSnapshotDataPairsWithData<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]> {
  return getDocumentSnapshotDataPairs(documents).then((x) => x.filter((y) => !!y.data) as FirestoreDocumentSnapshotDataPairWithData<D>[]);
}

/**
 * A tuple of `[document, data]` where `data` is the raw snapshot data (without `id`/`key` injection)
 * or `undefined` if the document doesn't exist.
 */
export type FirestoreDocumentSnapshotDataTuple<D extends FirestoreDocument<any>> = [D, Maybe<FirestoreDocumentData<D>>];

/**
 * Fetches raw snapshot data tuples for multiple documents in parallel.
 *
 * Unlike {@link getDocumentSnapshotDataPairs}, this returns a lightweight `[document, data]` tuple
 * and does not inject `id`/`key` fields onto the data. The `data` value is the raw result of
 * `snapshot.data()` and may be `undefined` for non-existent documents.
 *
 * @param documents - Documents to fetch
 * @returns Tuples in the same order as the input array
 */
export function getDocumentSnapshotDataTuples<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataTuple<D>[]> {
  return runAsyncTasksForValues(documents, (document) => document.accessor.get().then((snapshot) => [document, snapshot.data()]));
}

/**
 * Fetches the data from a single document's snapshot.
 *
 * By default (`withId=true`), the returned data has `id` and `key` fields injected via
 * {@link documentDataWithIdAndKey}. Pass `withId=false` to get the raw snapshot data instead.
 *
 * Returns `undefined` if the document does not exist.
 *
 * @param document - The document to fetch data for
 * @param withId - Whether to inject `id` and `key` fields onto the data (default: `true`)
 * @returns The document's data, or `undefined` if it doesn't exist
 */
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId: true): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId: false): Promise<Maybe<FirestoreDocumentData<D>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId?: boolean): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>> | FirestoreDocumentData<D>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId = true): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>> | FirestoreDocumentData<D>>> {
  return document.accessor.get().then((x: DocumentSnapshot<any>) => documentDataFunction<FirestoreDocumentData<D>>(withId)(x));
}

/**
 * Fetches data for multiple documents in parallel, filtering out non-existent documents.
 *
 * By default (`withId=true`), each data object has `id` and `key` fields injected.
 * Documents that don't exist in Firestore are excluded from the results (the returned
 * array may be shorter than the input).
 *
 * @param documents - Documents to fetch data for
 * @param withId - Whether to inject `id` and `key` fields onto each data object (default: `true`)
 * @returns Data objects for existing documents only
 */
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: false): Promise<FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId?: boolean): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId = true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]> {
  return getDocumentSnapshots<D>(documents).then((x: DocumentSnapshot<any>[]) => getDataFromDocumentSnapshots<FirestoreDocumentData<D>>(x, withId));
}

/**
 * Extracts data from an array of {@link DocumentSnapshot}s, filtering out snapshots for non-existent documents.
 *
 * By default (`withId=true`), each data object has `id` and `key` fields injected via {@link documentDataWithIdAndKey}.
 * Snapshots where `data()` returns `undefined` are removed from the output via {@link filterMaybeArrayValues}.
 *
 * @param snapshots - Snapshots to extract data from
 * @param withId - Whether to inject `id` and `key` fields onto each data object (default: `true`)
 * @returns Data objects for existing documents only (may be shorter than input)
 */
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[]): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: true): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: false): T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId?: boolean): DocumentDataWithIdAndKey<T>[] | T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: boolean = true): DocumentDataWithIdAndKey<T>[] | T[] {
  const mapFn = documentDataFunction<T>(withId);
  return filterMaybeArrayValues<T>(snapshots.map(mapFn));
}

/**
 * Creates {@link FirestoreDocument} instances for all documents in a {@link QuerySnapshot}.
 *
 * Maps each document in `snapshots.docs` to a loaded document via `accessor.loadDocument(ref)`.
 * No additional data fetching occurs; the documents are loaded from their existing references.
 *
 * @param accessor - Accessor to load documents with
 * @param snapshots - Query snapshot containing the document references
 * @returns Document instances in the same order as the query results
 */
export function loadDocumentsForSnapshots<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, snapshots: QuerySnapshot<T>): D[] {
  return snapshots.docs.map((x) => accessor.loadDocument(x.ref));
}

/**
 * Extracts {@link DocumentReference}s from arbitrary values and loads them as {@link FirestoreDocument} instances.
 *
 * Convenience function that maps values through `getRef` then delegates to {@link loadDocumentsForDocumentReferences}.
 *
 * @param accessor - Accessor to load documents with
 * @param values - Source values to extract references from
 * @param getRef - Extracts a document reference from each value
 * @returns Document instances in the same order as the input values
 */
export function loadDocumentsForDocumentReferencesFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getRef: (value: I) => DocumentReference<T>): D[] {
  return loadDocumentsForDocumentReferences(accessor, values.map(getRef));
}

/**
 * Alias for {@link loadDocumentsForDocumentReferencesFromValues}.
 */
export const loadDocumentsForValues = loadDocumentsForDocumentReferencesFromValues;

/**
 * Loads {@link FirestoreDocument} instances from an array of {@link DocumentReference}s.
 *
 * Each reference is passed to `accessor.loadDocument()` to create a document wrapper.
 * No network calls are made; this only creates in-memory document instances bound to the given references.
 *
 * @param accessor - Accessor to load documents with
 * @param refs - Document references to load
 * @returns Document instances in the same order as the input references
 */
export function loadDocumentsForDocumentReferences<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, refs: DocumentReference<T>[]): D[] {
  return refs.map((x) => accessor.loadDocument(x));
}

/**
 * Extracts {@link FirestoreModelKey}s from arbitrary values and loads them as {@link FirestoreDocument} instances.
 *
 * Convenience function that maps values through `getKey` then delegates to {@link loadDocumentsForKeys}.
 *
 * @param accessor - Accessor to load documents with
 * @param values - Source values to extract keys from
 * @param getKey - Extracts a model key (full Firestore path) from each value
 * @returns Document instances in the same order as the input values
 */
export function loadDocumentsForKeysFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getKey: (value: I) => FirestoreModelKey): D[] {
  return loadDocumentsForKeys(accessor, values.map(getKey));
}

/**
 * Loads {@link FirestoreDocument} instances from an array of full Firestore document paths (keys).
 *
 * Each key is passed to `accessor.loadDocumentForKey()`. No network calls are made.
 *
 * @param accessor - Accessor to load documents with
 * @param keys - Full Firestore document paths (e.g. `'users/abc123'`)
 * @returns Document instances in the same order as the input keys
 */
export function loadDocumentsForKeys<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, keys: FirestoreModelKey[]): D[] {
  return keys.map((x) => accessor.loadDocumentForKey(x));
}

/**
 * Extracts {@link FirestoreModelId}s from arbitrary values and loads them as {@link FirestoreDocument} instances.
 *
 * Convenience function that maps values through `getId` then delegates to {@link loadDocumentsForIds}.
 * Requires a full {@link FirestoreDocumentAccessor} (not limited) because loading by ID requires collection context.
 *
 * @param accessor - Accessor to load documents with (must have collection context for ID resolution)
 * @param values - Source values to extract IDs from
 * @param getId - Extracts a model ID from each value
 * @returns Document instances in the same order as the input values
 */
export function loadDocumentsForIdsFromValues<I, T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, values: I[], getId: (value: I) => FirestoreModelId): D[] {
  return loadDocumentsForIds(accessor, values.map(getId));
}

/**
 * Loads {@link FirestoreDocument} instances from an array of document IDs relative to the accessor's collection.
 *
 * Each ID is passed to `accessor.loadDocumentForId()`. Requires a full {@link FirestoreDocumentAccessor}
 * because ID-based loading needs the collection reference to resolve the full path. No network calls are made.
 *
 * @param accessor - Accessor to load documents with (must have collection context)
 * @param ids - Document IDs within the accessor's collection
 * @returns Document instances in the same order as the input IDs
 */
export function loadDocumentsForIds<T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, ids: FirestoreModelId[]): D[] {
  return ids.map((x) => accessor.loadDocumentForId(x));
}

/**
 * Function type that loads {@link FirestoreDocument} instances from {@link DocumentReference}s.
 *
 * When a {@link Transaction} is provided, the returned documents are bound to that transaction's accessor,
 * ensuring reads/writes participate in the transaction. Otherwise, the default accessor is used.
 */
export type FirestoreDocumentLoader<T, D extends FirestoreDocument<T>> = (references: DocumentReference<T>[], transaction?: Transaction) => D[];

/**
 * Creates a {@link FirestoreDocumentLoader} from a {@link LimitedFirestoreDocumentAccessorContextExtension}.
 *
 * The returned loader resolves the appropriate accessor based on whether a transaction is provided,
 * then delegates to {@link loadDocumentsForDocumentReferences}.
 *
 * @param accessorContext - Context that provides accessors for both default and transactional use
 * @returns A loader function that converts document references to document instances
 */
export function firestoreDocumentLoader<T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentLoader<T, D> {
  return (references: DocumentReference<T>[], transaction?: Transaction) => {
    const accessor = transaction ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    return loadDocumentsForDocumentReferences(accessor, references);
  };
}

/**
 * Function type that converts {@link DocumentSnapshot}s into {@link FirestoreDocumentSnapshotDataPair}s.
 *
 * Loads a document for each snapshot's reference and extracts data with `id`/`key` fields.
 * When a {@link Transaction} is provided, documents are bound to that transaction's accessor.
 */
export type FirestoreDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>> = (snapshots: DocumentSnapshot<T>[], transaction?: Transaction) => FirestoreDocumentSnapshotDataPair<D>[];

/**
 * Variant of {@link FirestoreDocumentSnapshotPairsLoader} for {@link QueryDocumentSnapshot}s.
 *
 * Since query snapshots always contain data, the returned pairs use
 * {@link FirestoreDocumentSnapshotDataPairWithData} where `data` is guaranteed non-nullish.
 */
export type FirestoreQueryDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>> = (snapshots: QueryDocumentSnapshot<T>[], transaction?: Transaction) => FirestoreDocumentSnapshotDataPairWithData<D>[];

/**
 * Creates a {@link FirestoreDocumentSnapshotPairsLoader} from a {@link LimitedFirestoreDocumentAccessorContextExtension}.
 *
 * The returned loader resolves the appropriate accessor based on whether a transaction is provided,
 * then maps each snapshot to a {@link FirestoreDocumentSnapshotDataPair} using {@link firestoreDocumentSnapshotPairsLoaderInstance}.
 *
 * Also satisfies the {@link FirestoreQueryDocumentSnapshotPairsLoader} type since the implementation
 * handles both {@link DocumentSnapshot} and {@link QueryDocumentSnapshot} inputs.
 *
 * @param accessorContext - Context that provides accessors for both default and transactional use
 * @returns A loader function that converts snapshots to document-snapshot-data pairs
 */
export function firestoreDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentSnapshotPairsLoader<T, D> & FirestoreQueryDocumentSnapshotPairsLoader<T, D> {
  return (snapshots: QueryDocumentSnapshot<T>[] | DocumentSnapshot<T>[], transaction?: Transaction) => {
    const accessor = transaction ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    const instance = firestoreDocumentSnapshotPairsLoaderInstance(accessor);
    return snapshots.map(instance) as FirestoreDocumentSnapshotDataPairWithData<D>[];
  };
}

/**
 * A callable that converts a single snapshot into a {@link FirestoreDocumentSnapshotDataPair},
 * with the accessor already bound.
 *
 * Overloaded: when given a {@link QueryDocumentSnapshot} (which always has data), returns
 * {@link FirestoreDocumentSnapshotDataPairWithData}. When given a {@link DocumentSnapshot},
 * returns the base {@link FirestoreDocumentSnapshotDataPair} where `data` may be `undefined`.
 *
 * Exposes `_accessor` for inspection of the bound accessor.
 */
export type FirestoreDocumentSnapshotPairsLoaderInstance<T, D extends FirestoreDocument<T>> = (((snapshot: QueryDocumentSnapshot<T>) => FirestoreDocumentSnapshotDataPairWithData<D>) & ((snapshots: DocumentSnapshot<T>) => FirestoreDocumentSnapshotDataPair<D>)) & {
  readonly _accessor: LimitedFirestoreDocumentAccessor<T, D>;
};

/**
 * Creates a {@link FirestoreDocumentSnapshotPairsLoaderInstance} bound to a specific accessor.
 *
 * The returned function converts a snapshot into a {@link FirestoreDocumentSnapshotDataPair} by:
 * 1. Extracting data with `id`/`key` fields via {@link documentDataWithIdAndKey}
 * 2. Loading the document from the snapshot's reference via `accessor.loadDocument()`
 * 3. Combining all three into a single pair object
 *
 * @param accessor - The accessor to bind for document loading
 * @returns A reusable function that converts snapshots to pairs using the bound accessor
 */
export function firestoreDocumentSnapshotPairsLoaderInstance<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>): FirestoreDocumentSnapshotPairsLoaderInstance<T, D> {
  const fn = ((snapshot: QueryDocumentSnapshot<T> | DocumentSnapshot<T>) => {
    const data = documentDataWithIdAndKey(snapshot) as DocumentDataWithIdAndKey<FirestoreDocumentData<D>>;
    const document = accessor.loadDocument(snapshot.ref);

    const pair: FirestoreDocumentSnapshotDataPair<D> | FirestoreDocumentSnapshotDataPairWithData<D> = {
      data,
      snapshot: snapshot as DocumentSnapshot<FirestoreDocumentData<D>>,
      document
    };

    return pair;
  }) as Building<FirestoreDocumentSnapshotPairsLoaderInstance<T, D>>;
  fn._accessor = accessor;
  return fn as FirestoreDocumentSnapshotPairsLoaderInstance<T, D>;
}

/**
 * Alias for {@link firestoreDocumentSnapshotPairsLoader}, typed specifically as a {@link FirestoreQueryDocumentSnapshotPairsLoader}.
 *
 * Use this when you know all input snapshots are from a query and want the stronger return type
 * that guarantees `data` is non-nullish.
 */
export const firestoreQueryDocumentSnapshotPairsLoader: <T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>) => FirestoreQueryDocumentSnapshotPairsLoader<T, D> = firestoreDocumentSnapshotPairsLoader;

/**
 * Extracts data from a {@link DocumentSnapshot}, optionally injecting `id` and `key` fields.
 *
 * When `withId` is `true` (default is `false`), delegates to {@link documentDataWithIdAndKey} to mutate
 * the data object with `id` (document ID) and `key` (full document path). When `false`, returns the
 * raw result of `snapshot.data()`.
 *
 * For {@link QueryDocumentSnapshot} inputs, the return value is guaranteed non-nullish.
 * For {@link DocumentSnapshot} inputs, may return `undefined` if the document doesn't exist.
 *
 * @param snapshot - The snapshot to extract data from
 * @param withId - Whether to inject `id` and `key` fields (default: `false`)
 * @returns The snapshot data, or `undefined` for non-existent documents
 */
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>): DocumentDataWithIdAndKey<T>;
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>, withId: true): DocumentDataWithIdAndKey<T>;
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>, withId: false): T;
export function documentData<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: true): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: false): Maybe<T>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId = false): Maybe<T> | Maybe<DocumentDataWithIdAndKey<T>> {
  const result = withId ? documentDataWithIdAndKey(snapshot) : snapshot.data();
  return result;
}

/**
 * Function type that extracts raw data from a snapshot. Returns `undefined` for non-existent documents.
 */
export type DocumentDataFunction<T> = ((snapshot: QueryDocumentSnapshot<T>) => T) & ((snapshot: DocumentSnapshot<T>) => Maybe<T>);

/**
 * Function type that extracts data from a snapshot with `id` and `key` fields injected.
 * Returns `undefined` for non-existent documents.
 */
export type DocumentDataWithIdAndKeyFunction<T> = ((snapshot: QueryDocumentSnapshot<T>) => DocumentDataWithIdAndKey<T>) & ((snapshot: DocumentSnapshot<T>) => Maybe<DocumentDataWithIdAndKey<T>>);

/**
 * Returns a data extraction function based on whether `id`/`key` injection is desired.
 *
 * When `withId` is `true`, returns {@link documentDataWithIdAndKey} (a {@link DocumentDataWithIdAndKeyFunction}).
 * When `false`, returns a simple `snapshot.data()` wrapper (a {@link DocumentDataFunction}).
 *
 * Useful for creating reusable mappers when processing arrays of snapshots.
 *
 * @param withId - Whether the returned function should inject `id` and `key` fields
 * @returns A snapshot-to-data extraction function
 */
export function documentDataFunction<T>(withId: true): DocumentDataWithIdAndKeyFunction<T>;
export function documentDataFunction<T>(withId: false): DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T> {
  return withId ? documentDataWithIdAndKey : (((snapshot) => snapshot.data()) as DocumentDataFunction<T>);
}

/**
 * Extracts data from a {@link DocumentSnapshot} and mutates it to include `id` and `key` fields.
 *
 * The `id` is set to `snapshot.id` (the document's ID within its collection) and `key` is set
 * to `snapshot.ref.path` (the full Firestore document path). The mutation is performed in-place
 * on the data object returned by `snapshot.data()`.
 *
 * For {@link QueryDocumentSnapshot} inputs, the return value is guaranteed non-nullish.
 * Returns `undefined` if the document does not exist (i.e. `snapshot.data()` returns falsy).
 *
 * @param snapshot - The snapshot to extract and augment data from
 * @returns The data object with `id` and `key` fields, or `undefined` if the document doesn't exist
 */
export function documentDataWithIdAndKey<T>(snapshot: QueryDocumentSnapshot<T>): DocumentDataWithIdAndKey<T>;
export function documentDataWithIdAndKey<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentDataWithIdAndKey<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>> {
  const data = snapshot.data() as DocumentDataWithIdAndKey<T>;

  if (data) {
    setIdAndKeyFromSnapshotOnDocumentData(data, snapshot);
  }

  return data;
}

/**
 * Mutates the input data object to include `id` and `key` fields from a {@link DocumentSnapshot}.
 *
 * Sets `data.id` to `snapshot.id` and `data.key` to `snapshot.ref.path`. The data object
 * is modified in-place and also returned for chaining convenience.
 *
 * @param data - The data object to augment (mutated in-place)
 * @param snapshot - Source of the `id` and `key` values
 * @returns The same data object, now typed as {@link DocumentDataWithIdAndKey}
 */
export function setIdAndKeyFromSnapshotOnDocumentData<T>(data: T, snapshot: DocumentSnapshot<T>): DocumentDataWithIdAndKey<T> {
  const target = data as DocumentDataWithIdAndKey<T>;

  target.id = snapshot.id; //set the id on data
  target.key = snapshot.ref.path; // set the path/key on the data

  return target;
}

/**
 * Mutates the input data object to include `id` and `key` fields from a model reference.
 *
 * Similar to {@link setIdAndKeyFromSnapshotOnDocumentData}, but sources the values from a
 * {@link FirestoreModelKeyRef} & {@link FirestoreModelIdRef} instead of a snapshot.
 * The data object is modified in-place and also returned for chaining convenience.
 *
 * @param data - The data object to augment (mutated in-place)
 * @param modelRef - Source of the `id` and `key` values
 * @returns The same data object, now typed as {@link DocumentDataWithIdAndKey}
 */
export function setIdAndKeyFromKeyIdRefOnDocumentData<T>(data: T, modelRef: FirestoreModelKeyRef & FirestoreModelIdRef): DocumentDataWithIdAndKey<T> {
  const target = data as DocumentDataWithIdAndKey<T>;

  target.id = modelRef.id; // set the id on data
  target.key = modelRef.key; // set the path/key on data

  return target;
}

/**
 * Fetches a document's snapshot and passes it to a `use` callback, following the {@link UseAsync} pattern.
 *
 * If `document` is nullish, the `use` callback is not invoked and `defaultValue` is returned instead.
 * If `document` exists but the snapshot is nullish (shouldn't happen in practice), `defaultValue` is also used.
 *
 * @param document - The document to fetch, or nullish to skip
 * @param use - Callback that receives the fetched snapshot and returns a result
 * @param defaultValue - Fallback value when `document` is nullish or the snapshot is unavailable
 * @returns The result of `use`, or the default value
 */
export async function useDocumentSnapshot<D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<DocumentSnapshot<FirestoreDocumentData<D>>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>): Promise<Maybe<O>> {
  const snapshot = await document?.accessor.get();
  return useAsync(snapshot, use, defaultValue);
}

/**
 * Fetches a document's snapshot data (via `snapshot.data()`) and passes it to a `use` callback.
 *
 * Wraps {@link useDocumentSnapshot} with a mapping step that extracts raw data from the snapshot.
 * If the document doesn't exist (data is `undefined`), the `use` callback is not invoked
 * and `defaultValue` is returned instead.
 *
 * @param document - The document to fetch, or nullish to skip
 * @param use - Callback that receives the snapshot data and returns a result
 * @param defaultValue - Fallback value when the document is nullish or doesn't exist
 * @returns The result of `use`, or the default value
 */
export const useDocumentSnapshotData = wrapUseAsyncFunction(useDocumentSnapshot, (x) => x.data()) as <D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<FirestoreDocumentData<D>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => Promise<Maybe<O>>;

// MARK: Key Accessors
/**
 * Extracts the document ID ({@link FirestoreModelId}) from a {@link FirestoreDocument}.
 *
 * Useful as a mapper function, e.g. `documents.map(firestoreModelIdFromDocument)`.
 *
 * @param document - The document to extract the ID from
 * @returns The document's ID (the last segment of its Firestore path)
 */
export function firestoreModelIdFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelId {
  return document.id;
}

/**
 * Extracts document IDs from an array of {@link FirestoreDocument}s.
 *
 * @param documents - Documents to extract IDs from
 * @returns Array of document IDs in the same order as the input
 */
export function firestoreModelIdsFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelId[] {
  return documents.map(firestoreModelIdFromDocument);
}

/**
 * Extracts the full Firestore path ({@link FirestoreModelKey}) from a {@link FirestoreDocument}.
 *
 * Useful as a mapper function, e.g. `documents.map(firestoreModelKeyFromDocument)`.
 *
 * @param document - The document to extract the key from
 * @returns The document's full Firestore path (e.g. `'users/abc123'`)
 */
export function firestoreModelKeyFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelKey {
  return document.key;
}

/**
 * Extracts full Firestore paths from an array of {@link FirestoreDocument}s.
 *
 * @param documents - Documents to extract keys from
 * @returns Array of full Firestore paths in the same order as the input
 */
export function firestoreModelKeysFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelKey[] {
  return documents.map(firestoreModelKeyFromDocument);
}

/**
 * Extracts the {@link DocumentReference} from a {@link FirestoreDocument}.
 *
 * Useful as a mapper function, e.g. `documents.map(documentReferenceFromDocument)`.
 *
 * @param document - The document to extract the reference from
 * @returns The underlying Firestore document reference
 */
export function documentReferenceFromDocument<T, D extends FirestoreDocument<T>>(document: D): DocumentReference<T> {
  return document.documentRef;
}

/**
 * Extracts {@link DocumentReference}s from an array of {@link FirestoreDocument}s.
 *
 * @param documents - Documents to extract references from
 * @returns Array of document references in the same order as the input
 */
export function documentReferencesFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): DocumentReference<T>[] {
  return documents.map(documentReferenceFromDocument);
}

// MARK: LimitedFirestoreDocumentAccessorSnapshotCache
/**
 * An in-memory snapshot cache backed by a {@link LimitedFirestoreDocumentAccessor} that deduplicates
 * Firestore reads for the same document key within a single operation scope.
 *
 * The cache is keyed by {@link FirestoreModelKey} (full Firestore path) and stores the in-flight or
 * resolved {@link FirestoreDocumentSnapshotDataPair} promises. This ensures that concurrent or repeated
 * requests for the same document reuse a single Firestore read.
 *
 * Does not implement {@link LimitedFirestoreDocumentAccessor} itself — it is a higher-level abstraction
 * that wraps an accessor to provide cached snapshot reads. The underlying accessor is exposed via
 * the {@link accessor} property for direct use when needed.
 *
 * Useful in batch processing or fan-out scenarios where multiple code paths may reference the same
 * documents and you want to avoid redundant reads without manual deduplication.
 *
 * @example
 * ```typescript
 * const cache = limitedFirestoreDocumentAccessorSnapshotCache(accessor);
 *
 * // Both calls resolve from a single Firestore read
 * const [pair1, pair2] = await Promise.all([
 *   cache.getDocumentSnapshotDataPairForKey('users/abc123'),
 *   cache.getDocumentSnapshotDataPairForKey('users/abc123')
 * ]);
 * ```
 */
export interface LimitedFirestoreDocumentAccessorSnapshotCache<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * The underlying accessor used to load documents and fetch snapshots.
   */
  readonly accessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * Fetches or returns the cached {@link FirestoreDocumentSnapshotDataPair} for the given key.
   *
   * @param key - Full Firestore document path (e.g. `'users/abc123'`)
   * @returns The document, its snapshot, and extracted data (data may be `undefined` if the document doesn't exist)
   */
  getDocumentSnapshotDataPairForKey(key: FirestoreModelKey): Promise<FirestoreDocumentSnapshotDataPair<D>>;
  /**
   * Fetches or returns cached {@link FirestoreDocumentSnapshotDataPair}s for multiple keys.
   *
   * Each key is resolved independently through the cache, so previously fetched documents are not re-read.
   *
   * @param keys - Full Firestore document paths
   * @returns Pairs in the same order as the input keys
   */
  getDocumentSnapshotDataPairsForKeys(keys: FirestoreModelKey[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]>;
  /**
   * Fetches or returns cached pairs for multiple keys, filtering out non-existent documents.
   *
   * Convenience method that delegates to {@link getDocumentSnapshotDataPairsForKeys} and removes entries
   * where `data` is nullish, returning only {@link FirestoreDocumentSnapshotDataPairWithData} results.
   *
   * @param keys - Full Firestore document paths
   * @returns Pairs for existing documents only, in their original relative order
   */
  getDocumentSnapshotDataPairsWithDataForKeys(keys: FirestoreModelKey[]): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]>;
}

/**
 * Creates a {@link LimitedFirestoreDocumentAccessorSnapshotCache} that wraps the given accessor
 * with an in-memory {@link Map} cache so that repeated loads for the same key return the cached
 * promise instead of re-reading from Firestore.
 *
 * The cache stores the promise itself (not the resolved value), which means concurrent requests
 * for the same key that arrive before the first read completes will also be deduplicated.
 *
 * The cache lives for the lifetime of the returned object and is never invalidated, so this is
 * best suited for short-lived scopes (e.g. a single request or batch operation) where stale reads
 * are acceptable.
 *
 * @param accessor - The accessor to wrap with caching behavior
 * @returns A {@link LimitedFirestoreDocumentAccessorSnapshotCache} backed by the given accessor
 *
 * @example
 * ```typescript
 * const cache = limitedFirestoreDocumentAccessorSnapshotCache(accessor);
 *
 * // First call reads from Firestore; second call returns cached result
 * const pair = await cache.getDocumentSnapshotDataPairForKey('users/abc123');
 * const samePair = await cache.getDocumentSnapshotDataPairForKey('users/abc123');
 *
 * // Batch fetch with automatic deduplication
 * const pairs = await cache.getDocumentSnapshotDataPairsWithDataForKeys(['users/abc', 'users/def']);
 *
 * // Access the underlying accessor directly
 * const doc = cache.accessor.loadDocumentForKey('users/xyz');
 * ```
 */
export function limitedFirestoreDocumentAccessorSnapshotCache<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>): LimitedFirestoreDocumentAccessorSnapshotCache<T, D> {
  const cache = new Map<FirestoreModelKey, Promise<FirestoreDocumentSnapshotDataPair<D>>>();

  function getDocumentSnapshotDataPairForKey(key: FirestoreModelKey): Promise<FirestoreDocumentSnapshotDataPair<D>> {
    let cached = cache.get(key);

    if (!cached) {
      const document = accessor.loadDocumentForKey(key);
      cached = getDocumentSnapshotDataPair(document);
      cache.set(key, cached);
    }

    return cached;
  }

  async function getDocumentSnapshotDataPairsForKeys(keys: FirestoreModelKey[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]> {
    return Promise.all(keys.map((key) => getDocumentSnapshotDataPairForKey(key)));
  }

  async function getDocumentSnapshotDataPairsWithDataForKeys(keys: FirestoreModelKey[]): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]> {
    const pairs = await getDocumentSnapshotDataPairsForKeys(keys);
    return filterMaybeArrayValues(pairs.map((pair) => (pair.data != null ? (pair as FirestoreDocumentSnapshotDataPairWithData<D>) : undefined)));
  }

  return {
    accessor,
    getDocumentSnapshotDataPairForKey,
    getDocumentSnapshotDataPairsForKeys,
    getDocumentSnapshotDataPairsWithDataForKeys
  };
}
