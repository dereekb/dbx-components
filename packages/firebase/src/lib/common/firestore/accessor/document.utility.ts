import { type AsyncGetterOrValue, type Maybe, performMakeLoop, type UseAsync, wrapUseAsyncFunction, useAsync, makeWithFactory, filterMaybeArrayValues, runAsyncTasksForValues, type Building } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelIdRef, type FirestoreModelKey, type FirestoreModelKeyRef } from '../collection';
import { type QueryDocumentSnapshot, type DocumentDataWithIdAndKey, type DocumentReference, type DocumentSnapshot, type QuerySnapshot, type Transaction } from '../types';
import { type FirestoreDocumentData, type FirestoreDocument, type FirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessorContextExtension } from './document';

/**
 * Creates an array of new FirestoreDocument instances without creating them in Firestore.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type
 * @param documentAccessor - The document accessor to use for creating document instances
 * @param count - The number of document instances to create
 * @returns An array of new document instances
 */
export function newDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, count: number): D[] {
  return makeWithFactory(() => documentAccessor.newDocument(), count);
}

/**
 * Parameters for creating and initializing multiple Firestore documents.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type
 */
export interface MakeDocumentsParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  /**
   * The number of documents to create.
   */
  readonly count: number;

  /**
   * Optional override to create a new document using the input accessor.
   * If not provided, the accessor's default newDocument method will be used.
   *
   * @param documentAccessor - The document accessor to use for creating document instances
   * @returns A new document instance
   */
  readonly newDocument?: (documentAccessor: FirestoreDocumentAccessor<T, D>) => D;

  /**
   * Initializes the document with data and/or performs tasks with the document.
   *
   * If this function returns a value (not null/undefined), that data will be used
   * to create the document in Firestore. If it returns null/undefined, no document
   * will be created in Firestore but the document instance will still be returned.
   *
   * @param i - The index of the document being created (0 to count-1)
   * @param document - The document instance to initialize
   * @returns Document data to create in Firestore, or null/undefined to skip creation
   */
  readonly init: (i: number, document: D) => Maybe<T> | Promise<Maybe<T>>;
}

/**
 * Creates multiple documents in Firestore and returns the document instances.
 *
 * For each document, this function:
 * 1. Creates a new document instance using the specified or default factory
 * 2. Calls the init function with the document instance
 * 3. If init returns data, creates the document in Firestore
 * 4. Returns all document instances, whether they were created in Firestore or not
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type
 * @param documentAccessor - The document accessor to use for creating document instances
 * @param make - Parameters for document creation and initialization
 * @returns A promise that resolves to an array of document instances
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
 * Retrieves DocumentSnapshots for an array of documents in parallel.
 *
 * This is useful for fetching the current state of multiple documents at once.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to get snapshots for
 * @returns Promise that resolves to an array of DocumentSnapshots in the same order as the input documents
 */
export function getDocumentSnapshots<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return runAsyncTasksForValues(documents, (x) => x.accessor.get());
}

/**
 * A pair containing both a FirestoreDocument instance and its current DocumentSnapshot.
 *
 * This allows keeping track of both the document reference and its data.
 *
 * @template D - The FirestoreDocument implementation type
 */
export type FirestoreDocumentSnapshotPair<D extends FirestoreDocument<any>> = {
  /** The original document instance */
  readonly document: D;
  /** The current snapshot of the document from Firestore */
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
};

/**
 * Creates a document-snapshot pair from a document instance.
 *
 * Fetches the current snapshot of the document and returns both the original
 * document instance and the snapshot together.
 *
 * @template D - The FirestoreDocument implementation type
 * @param document - The document instance to get a snapshot for
 * @returns Promise that resolves to a document-snapshot pair
 */
export function getDocumentSnapshotPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot }));
}

/**
 * Creates document-snapshot pairs for an array of documents in parallel.
 *
 * Fetches the current snapshot of each document and returns pairs containing both
 * the original document instances and their snapshots.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to get snapshots for
 * @returns Promise that resolves to an array of document-snapshot pairs in the same order as the input documents
 */
export function getDocumentSnapshotPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotPair);
}

/**
 * A tuple containing a document instance, its snapshot, and the extracted data.
 *
 * Provides a comprehensive view of a document with its reference, snapshot state,
 * and formatted data (including ID and key fields).
 *
 * @template D - The FirestoreDocument implementation type
 */
export interface FirestoreDocumentSnapshotDataPair<D extends FirestoreDocument<any>> {
  /** The original document instance */
  readonly document: D;
  /** The current snapshot of the document from Firestore */
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
  /** The document data with ID and key fields added, or undefined if the document doesn't exist */
  readonly data: Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>;
}

/**
 * A variant of FirestoreDocumentSnapshotDataPair that guarantees data exists.
 *
 * This interface is used when you need to ensure that only documents with existing
 * data are included in the results.
 *
 * @template D - The FirestoreDocument implementation type
 */
export interface FirestoreDocumentSnapshotDataPairWithData<D extends FirestoreDocument<any>> extends Omit<FirestoreDocumentSnapshotDataPair<D>, 'data'> {
  /** The document data with ID and key fields added (guaranteed to exist) */
  readonly data: DocumentDataWithIdAndKey<FirestoreDocumentData<D>>;
}

/**
 * Creates a document-snapshot-data triplet from a document instance.
 *
 * Fetches the current snapshot of the document, extracts its data with ID and key fields,
 * and returns all three together in a single object.
 *
 * @template D - The FirestoreDocument implementation type
 * @param document - The document instance to get data for
 * @returns Promise that resolves to a document-snapshot-data triplet
 */
export function getDocumentSnapshotDataPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotDataPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot, data: documentDataWithIdAndKey(snapshot) }));
}

/**
 * Creates document-snapshot-data triplets for an array of documents in parallel.
 *
 * Fetches the current snapshot of each document, extracts its data with ID and key fields,
 * and returns triplets containing all three components for each document.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to get data for
 * @returns Promise that resolves to an array of document-snapshot-data triplets in the same order as the input documents
 */
export function getDocumentSnapshotDataPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotDataPair);
}

/**
 * Creates document-snapshot-data triplets for an array of documents and filters out those without data.
 *
 * This is a convenience function that fetches data for all documents and then returns
 * only the triplets for documents that actually exist in Firestore.
 *
 * @template D - The FirestoreDocument implementation type
 * @param documents - Array of document instances to get data for
 * @returns Promise that resolves to an array of document-snapshot-data triplets for existing documents only
 */
export function getDocumentSnapshotDataPairsWithData<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]> {
  return getDocumentSnapshotDataPairs(documents).then((x) => x.filter((y) => !!y.data) as FirestoreDocumentSnapshotDataPairWithData<D>[]);
}

export type FirestoreDocumentSnapshotDataTuple<D extends FirestoreDocument<any>> = [D, Maybe<FirestoreDocumentData<D>>];

export function getDocumentSnapshotDataTuples<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataTuple<D>[]> {
  return runAsyncTasksForValues(documents, (document) => document.accessor.get().then((snapshot) => [document, snapshot.data()]));
}

export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId: true): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId: false): Promise<Maybe<FirestoreDocumentData<D>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId?: boolean): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>> | FirestoreDocumentData<D>>>;
export function getDocumentSnapshotData<D extends FirestoreDocument<any>>(document: D, withId = true): Promise<Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>> | FirestoreDocumentData<D>>> {
  return document.accessor.get().then((x: DocumentSnapshot<any>) => documentDataFunction<FirestoreDocumentData<D>>(withId)(x));
}

export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId: false): Promise<FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId?: boolean): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]>;
export function getDocumentSnapshotsData<D extends FirestoreDocument<any>>(documents: D[], withId = true): Promise<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>[] | FirestoreDocumentData<D>[]> {
  return getDocumentSnapshots<D>(documents).then((x: DocumentSnapshot<any>[]) => getDataFromDocumentSnapshots<FirestoreDocumentData<D>>(x, withId));
}

/**
 * Returns the data from all input snapshots. Snapshots without data are filtered out.
 *
 * @param snapshots
 */
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[]): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: true): DocumentDataWithIdAndKey<T>[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: false): T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId?: boolean): DocumentDataWithIdAndKey<T>[] | T[];
export function getDataFromDocumentSnapshots<T>(snapshots: DocumentSnapshot<T>[], withId: boolean = true): DocumentDataWithIdAndKey<T>[] | T[] {
  const mapFn = documentDataFunction<T>(withId);
  return filterMaybeArrayValues<T>(snapshots.map(mapFn));
}

export function loadDocumentsForSnapshots<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, snapshots: QuerySnapshot<T>): D[] {
  return snapshots.docs.map((x) => accessor.loadDocument(x.ref));
}

export function loadDocumentsForDocumentReferencesFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getRef: (value: I) => DocumentReference<T>): D[] {
  return loadDocumentsForDocumentReferences(accessor, values.map(getRef));
}

export const loadDocumentsForValues = loadDocumentsForDocumentReferencesFromValues;

export function loadDocumentsForDocumentReferences<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, refs: DocumentReference<T>[]): D[] {
  return refs.map((x) => accessor.loadDocument(x));
}

export function loadDocumentsForKeysFromValues<I, T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, values: I[], getKey: (value: I) => FirestoreModelKey): D[] {
  return loadDocumentsForKeys(accessor, values.map(getKey));
}

export function loadDocumentsForKeys<T, D extends FirestoreDocument<T>>(accessor: LimitedFirestoreDocumentAccessor<T, D>, keys: FirestoreModelKey[]): D[] {
  return keys.map((x) => accessor.loadDocumentForKey(x));
}

export function loadDocumentsForIdsFromValues<I, T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, values: I[], getId: (value: I) => FirestoreModelId): D[] {
  return loadDocumentsForIds(accessor, values.map(getId));
}

export function loadDocumentsForIds<T, D extends FirestoreDocument<T>>(accessor: FirestoreDocumentAccessor<T, D>, ids: FirestoreModelId[]): D[] {
  return ids.map((x) => accessor.loadDocumentForId(x));
}

/**
 * Used for loading documents for the input references.
 */
export type FirestoreDocumentLoader<T, D extends FirestoreDocument<T>> = (references: DocumentReference<T>[], transaction?: Transaction) => D[];

/**
 * Used to make a FirestoreDocumentLoader.
 *
 * @param accessorContext
 * @returns
 */
export function firestoreDocumentLoader<T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentLoader<T, D> {
  return (references: DocumentReference<T>[], transaction?: Transaction) => {
    const accessor = transaction ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    return loadDocumentsForDocumentReferences(accessor, references);
  };
}

/**
 * Used for loading documents for the input snapshots.
 */
export type FirestoreDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>> = (snapshots: DocumentSnapshot<T>[], transaction?: Transaction) => FirestoreDocumentSnapshotDataPair<D>[];

/**
 * Used for loading documents for the input query snapshots. Query snapshots always contain data.
 */
export type FirestoreQueryDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>> = (snapshots: QueryDocumentSnapshot<T>[], transaction?: Transaction) => FirestoreDocumentSnapshotDataPairWithData<D>[];

/**
 * Used to make a FirestoreDocumentSnapshotPairsLoader.
 *
 * @param accessorContext
 * @returns
 */
export function firestoreDocumentSnapshotPairsLoader<T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreDocumentSnapshotPairsLoader<T, D> & FirestoreQueryDocumentSnapshotPairsLoader<T, D> {
  return (snapshots: QueryDocumentSnapshot<T>[] | DocumentSnapshot<T>[], transaction?: Transaction) => {
    const accessor = transaction ? accessorContext.documentAccessorForTransaction(transaction) : accessorContext.documentAccessor();
    const instance = firestoreDocumentSnapshotPairsLoaderInstance(accessor);
    return snapshots.map(instance) as FirestoreDocumentSnapshotDataPairWithData<D>[];
  };
}

/**
 * Used for loading a FirestoreDocumentSnapshotDataPair for the input snapshot. The accessor is already available given the context.
 */
export type FirestoreDocumentSnapshotPairsLoaderInstance<T, D extends FirestoreDocument<T>> = (((snapshot: QueryDocumentSnapshot<T>) => FirestoreDocumentSnapshotDataPairWithData<D>) & ((snapshots: DocumentSnapshot<T>) => FirestoreDocumentSnapshotDataPair<D>)) & {
  readonly _accessor: LimitedFirestoreDocumentAccessor<T, D>;
};

/**
 * Used to make a FirestoreDocumentSnapshotPairsLoader.
 *
 * @param accessorContext
 * @returns
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
 * Used to make a FirestoreQueryDocumentSnapshotPairsLoader.
 *
 * @param accessorContext
 * @returns
 */
export const firestoreQueryDocumentSnapshotPairsLoader: <T, D extends FirestoreDocument<T>>(accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>) => FirestoreQueryDocumentSnapshotPairsLoader<T, D> = firestoreDocumentSnapshotPairsLoader;

/**
 * Creates the document data from the snapshot.
 *
 * @param snapshot
 * @returns
 */
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>): DocumentDataWithIdAndKey<T>;
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>, withId: true): DocumentDataWithIdAndKey<T>;
export function documentData<T>(snapshot: QueryDocumentSnapshot<T>, withId: false): T;
export function documentData<T>(snapshot: DocumentSnapshot<T>): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: true): Maybe<DocumentDataWithIdAndKey<T>>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId: false): Maybe<T>;
export function documentData<T>(snapshot: DocumentSnapshot<T>, withId = false): Maybe<T> | Maybe<DocumentDataWithIdAndKey<T>> {
  if (withId) {
    return documentDataWithIdAndKey(snapshot);
  } else {
    return snapshot.data();
  }
}

export type DocumentDataFunction<T> = ((snapshot: QueryDocumentSnapshot<T>) => T) & ((snapshot: DocumentSnapshot<T>) => Maybe<T>);
export type DocumentDataWithIdAndKeyFunction<T> = ((snapshot: QueryDocumentSnapshot<T>) => DocumentDataWithIdAndKey<T>) & ((snapshot: DocumentSnapshot<T>) => Maybe<DocumentDataWithIdAndKey<T>>);

export function documentDataFunction<T>(withId: true): DocumentDataWithIdAndKeyFunction<T>;
export function documentDataFunction<T>(withId: false): DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T>;
export function documentDataFunction<T>(withId: boolean): DocumentDataWithIdAndKeyFunction<T> | DocumentDataFunction<T> {
  return withId ? documentDataWithIdAndKey : (((snapshot) => snapshot.data()) as DocumentDataFunction<T>);
}

/**
 * Creates a DocumentDataWithId from the input DocumentSnapshot. If the data does not exist, returns undefined.
 *
 * @param snapshot
 * @returns
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
 * Sets the id and key values from the snapshot onto the input data.
 *
 * @param data
 * @param snapshot
 * @returns
 */
export function setIdAndKeyFromSnapshotOnDocumentData<T>(data: T, snapshot: DocumentSnapshot<T>): DocumentDataWithIdAndKey<T> {
  const target = data as DocumentDataWithIdAndKey<T>;

  target.id = snapshot.id; //set the id on data
  target.key = snapshot.ref.path; // set the path/key on the data

  return target;
}

/**
 * Sets the id and key values from the snapshot onto the input data.
 *
 * @param data
 * @param snapshot
 * @returns
 */
export function setIdAndKeyFromKeyIdRefOnDocumentData<T>(data: T, modelRef: FirestoreModelKeyRef & FirestoreModelIdRef): DocumentDataWithIdAndKey<T> {
  const target = data as DocumentDataWithIdAndKey<T>;

  target.id = modelRef.id; // set the id on data
  target.key = modelRef.key; // set the path/key on data

  return target;
}

/**
 * MappedUseAsyncFunction to load a snapshot from the input document and use it.
 *
 * @param document
 * @param use
 * @param defaultValue
 * @returns
 */
export async function useDocumentSnapshot<D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<DocumentSnapshot<FirestoreDocumentData<D>>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>): Promise<Maybe<O>> {
  const snapshot = await document?.accessor.get();
  return useAsync(snapshot, use, defaultValue);
}

/**
 * MappedUseAsyncFunction to load snapshot data from the input document and use it.
 */
export const useDocumentSnapshotData = wrapUseAsyncFunction(useDocumentSnapshot, (x) => x.data()) as <D extends FirestoreDocument<any>, O = void>(document: Maybe<D>, use: UseAsync<FirestoreDocumentData<D>, O>, defaultValue?: Maybe<AsyncGetterOrValue<O>>) => Promise<Maybe<O>>;

// MARK: Key Accessors
export function firestoreModelIdFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelId {
  return document.id;
}

export function firestoreModelIdsFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelId[] {
  return documents.map(firestoreModelIdFromDocument);
}

export function firestoreModelKeyFromDocument<T, D extends FirestoreDocument<T>>(document: D): FirestoreModelKey {
  return document.key;
}

export function firestoreModelKeysFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): FirestoreModelKey[] {
  return documents.map(firestoreModelKeyFromDocument);
}

export function documentReferenceFromDocument<T, D extends FirestoreDocument<T>>(document: D): DocumentReference<T> {
  return document.documentRef;
}

export function documentReferencesFromDocuments<T, D extends FirestoreDocument<T>>(documents: D[]): DocumentReference<T>[] {
  return documents.map(documentReferenceFromDocument);
}
