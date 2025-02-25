import { type AsyncGetterOrValue, type Maybe, performMakeLoop, type UseAsync, wrapUseAsyncFunction, useAsync, makeWithFactory, filterMaybeArrayValues, runAsyncTasksForValues, type Building } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelIdRef, type FirestoreModelKey, type FirestoreModelKeyRef } from '../collection';
import { type QueryDocumentSnapshot, type DocumentDataWithIdAndKey, type DocumentReference, type DocumentSnapshot, type QuerySnapshot, type Transaction } from '../types';
import { type FirestoreDocumentData, type FirestoreDocument, type FirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessor, type LimitedFirestoreDocumentAccessorContextExtension } from './document';

export function newDocuments<T, D extends FirestoreDocument<T>>(documentAccessor: FirestoreDocumentAccessor<T, D>, count: number): D[] {
  return makeWithFactory(() => documentAccessor.newDocument(), count);
}

export interface MakeDocumentsParams<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly count: number;

  /**
   * Optional override to create a new document using the input accessor.
   */
  readonly newDocument?: (documentAccessor: FirestoreDocumentAccessor<T, D>) => D;

  /**
   * Initializes the input document with the returned data.
   *
   * This function may also optionally perform tasks with the passed document and return null/undefined.
   */
  readonly init: (i: number, document: D) => Maybe<T> | Promise<Maybe<T>>;
}

/**
 * Makes a number of new documents.
 *
 * @param documentAccessor
 * @param make
 * @returns
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

export function getDocumentSnapshots<D extends FirestoreDocument<any>>(documents: D[]): Promise<DocumentSnapshot<FirestoreDocumentData<D>>[]> {
  return runAsyncTasksForValues(documents, (x) => x.accessor.get());
}

export type FirestoreDocumentSnapshotPair<D extends FirestoreDocument<any>> = {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
};

export function getDocumentSnapshotPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot }));
}

export function getDocumentSnapshotPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotPair);
}

export interface FirestoreDocumentSnapshotDataPair<D extends FirestoreDocument<any>> {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<FirestoreDocumentData<D>>;
  readonly data: Maybe<DocumentDataWithIdAndKey<FirestoreDocumentData<D>>>;
}

export interface FirestoreDocumentSnapshotDataPairWithData<D extends FirestoreDocument<any>> extends Omit<FirestoreDocumentSnapshotDataPair<D>, 'data'> {
  readonly data: DocumentDataWithIdAndKey<FirestoreDocumentData<D>>;
}

export function getDocumentSnapshotDataPair<D extends FirestoreDocument<any>>(document: D): Promise<FirestoreDocumentSnapshotDataPair<D>> {
  return document.accessor.get().then((snapshot) => ({ document, snapshot, data: documentDataWithIdAndKey(snapshot) }));
}

export function getDocumentSnapshotDataPairs<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPair<D>[]> {
  return runAsyncTasksForValues(documents, getDocumentSnapshotDataPair);
}

/**
 * Convenience function for calling getDocumentSnapshotDataPairs() then returning only the pairs that have data.
 */
export function getDocumentSnapshotDataPairsWithData<D extends FirestoreDocument<any>>(documents: D[]): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]> {
  return getDocumentSnapshotDataPairs(documents).then((pairs) => pairs.filter((pair) => pair.data != null) as FirestoreDocumentSnapshotDataPairWithData<D>[]);
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
